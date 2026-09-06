/**
 * Verdict storage.
 *
 * Keyed by the flavor key from shopify.js — a bare product handle, or
 * "<handle>::<flavor>" where the product's option is Flavor. No storefront
 * prefix: handles and flavor names are identical across de/fr/.com (verified),
 * while Shopify product and variant IDs are not, so bare keys mean a user's
 * ratings follow them between storefronts.
 *
 * Entry keys are short because storage.sync is quota-limited (~100 KB total,
 * 8 KB per item). `v` is the schema version: if the key format ever has to
 * change, bump SCHEMA and migrate on read.
 *
 *   { v: 1, items: { "capybara-colada": { r, rts, l, lts, lv, n } } }
 *     r   rating: "favorite" | "like" | "dislike"   (mutually exclusive)
 *     rts when the rating was set
 *     l   saved for later (independent of the rating)
 *     lts when it was saved for later
 *     lv  WHICH variant was saved: { i: id, t: title }
 *     n   note
 *
 * Why lv is data and not part of the key: "later" is an intent to buy a
 * specific thing — the shaker bundle is not the plain tub — but variant titles
 * are localized and variant ids are per-shop, so neither belongs in a key that
 * is supposed to travel. Stored as data it can degrade: id, then title, then
 * the default variant. A rating, by contrast, is about taste and must not
 * fragment across pack sizes.
 */
(function () {
  const HS = (globalThis.HolyShelf ||= {});
  const api = globalThis.browser ?? globalThis.chrome;

  const KEY = "shelf";
  const SCHEMA = 1;

  /* Falls back to local when sync is unavailable; Firefox stores locally and
     uploads once an account is connected, so this is only for odd builds. */
  const area = api.storage.sync ?? api.storage.local;

  const RATINGS = ["favorite", "like", "dislike"];
  const LISTS = ["favorite", "like", "dislike", "later"];

  const empty = () => ({ v: SCHEMA, items: {} });

  function migrate(raw) {
    if (!raw || typeof raw !== "object") return empty();
    if (raw.v === SCHEMA) return { v: SCHEMA, items: raw.items ?? {} };
    /* No older schema exists yet. When one does, step it forward here rather
       than discarding — this branch is why the version field is worth having. */
    return { v: SCHEMA, items: raw.items ?? {} };
  }

  let cache = null;

  async function read() {
    if (cache) return cache;
    const got = await area.get(KEY);
    cache = migrate(got?.[KEY]);
    return cache;
  }

  async function write(state) {
    cache = state;
    try {
      await area.set({ [KEY]: state });
    } catch (error) {
      /* Almost always QUOTA_BYTES. Surfaced rather than swallowed so a full
         store doesn't look like a silently ignored click. */
      console.error("[holy-shelf] could not save:", error);
      throw error;
    }
  }

  function blank() {
    return { r: null, rts: 0, l: false, lts: 0, lv: null, n: "" };
  }

  /** Drops entries that carry no information, so the quota isn't spent on them. */
  function prune(items, key) {
    const entry = items[key];
    if (entry && !entry.r && !entry.l && !entry.n) delete items[key];
  }

  async function update(key, mutate) {
    const state = await read();
    const items = { ...state.items };
    const entry = { ...blank(), ...(items[key] ?? {}) };
    mutate(entry);
    items[key] = entry;
    prune(items, key);
    await write({ v: SCHEMA, items });
    return items[key] ?? null;
  }

  HS.storage = {
    RATINGS,
    LISTS,
    read,

    async entry(key) {
      return (await read()).items[key] ?? null;
    },

    /** Passing the rating that is already set clears it. */
    setRating(key, rating) {
      return update(key, (entry) => {
        const next = entry.r === rating ? null : rating;
        entry.r = next;
        entry.rts = next ? Date.now() : 0;
      });
    },

    /**
     * One "later" per flavor, remembering which variant. Clicking while the
     * SAVED variant is selected clears it; clicking while a different one is
     * selected moves the entry to that variant instead — otherwise the button
     * would clear a save the shopper isn't currently looking at.
     */
    toggleLater(key, variant) {
      return update(key, (entry) => {
        const savedHere = !variant || !entry.lv || entry.lv.i === variant.id;

        if (entry.l && savedHere) {
          entry.l = false;
          entry.lts = 0;
          entry.lv = null;
          return;
        }

        entry.l = true;
        entry.lts = Date.now();
        entry.lv = variant ? { i: variant.id, t: variant.title } : null;
      });
    },

    /** Whether `variant` is the one this entry saved for later. */
    laterMatches(entry, variant) {
      if (!entry?.l) return false;
      if (!entry.lv || !variant) return true;
      return entry.lv.i === variant.id;
    },

    setNote(key, note) {
      return update(key, (entry) => {
        entry.n = note.trim();
      });
    },

    /** Removes a flavor from one list, leaving its other memberships alone. */
    removeFrom(key, list) {
      return update(key, (entry) => {
        if (list === "later") {
          entry.l = false;
          entry.lts = 0;
          entry.lv = null;
        } else if (entry.r === list) {
          entry.r = null;
          entry.rts = 0;
        }
      });
    },

    /** → { favorite: [{key, ts, note}], …, later: [{key, ts, note, lv}] } */
    async lists() {
      const { items } = await read();
      const out = Object.fromEntries(LISTS.map((list) => [list, []]));
      for (const [key, entry] of Object.entries(items)) {
        if (entry.r && out[entry.r]) {
          out[entry.r].push({ key, ts: entry.rts, note: entry.n });
        }
        if (entry.l) {
          out.later.push({ key, ts: entry.lts, note: entry.n, lv: entry.lv ?? null });
        }
      }
      return out;
    },

    /** Fires when another tab or another synced device changes the store. */
    onChange(callback) {
      api.storage.onChanged.addListener((changes, areaName) => {
        if (!changes[KEY]) return;
        if (areaName !== "sync" && areaName !== "local") return;
        cache = migrate(changes[KEY].newValue);
        callback(cache);
      });
    }
  };
})();
