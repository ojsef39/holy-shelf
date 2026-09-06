/**
 * Adds a "Lists" tab to the account page.
 *
 * /pages/account is a single page with hash routes (#rewards, #orders,
 * #addresses), so we add a fifth route the site doesn't know about rather than
 * inventing a page. The nav link is a CLONE of an existing one, so it inherits
 * the theme's styling and keeps matching after a redeploy.
 */
(function () {
  const HS = globalThis.HolyShelf;
  const { t } = HS.i18n;

  const ROUTE = "#lists";
  const TAB = "lists";

  const LISTS = [
    { id: "favorite", icon: "heart", label: "listFavorites" },
    { id: "later", icon: "clock", label: "listLater" },
    { id: "like", icon: "up", label: "listLiked" },
    { id: "dislike", icon: "down", label: "listDisliked", muted: true }
  ];

  const SORTS = [
    { id: "added", label: "sortAdded", key: (row) => -row.ts },
    { id: "name", label: "sortName", key: (row) => row.title.toLowerCase() },
    { id: "price", label: "sortPrice", key: (row) => row.price },
    { id: "stock", label: "sortStock", key: (row) => (row.available ? 0 : 1) }
  ];

  let view = { list: null, sort: "added", direction: 1 };
  let root = null;

  /* ---------- nav ---------- */

  function findNav() {
    const sibling = document.querySelector(
      '[data-account-tab], a[href$="#rewards"]'
    );
    return sibling ?? null;
  }

  /**
   * The visible tabs are <button data-account-tab="rewards"> inside
   * <li class="link-bar__link-item">; the hash links exist only in the mobile
   * "Mein Account" popover. We clone the LIST ITEM, not the button, so the tab
   * gets its own slot in the bar and keeps the theme's spacing.
   */
  function addTab() {
    /* There is more than one tab bar — a desktop .link-bar and a phone one —
       so every bar gets its own copy. Injecting into only the first one put
       our tab in a bar that is hidden at desktop widths. */
    const templates = document.querySelectorAll('[data-account-tab="rewards"]');
    if (templates.length === 0) return false;

    for (const template of templates) {
      const item = template.closest("li") ?? template;
      const bar = item.parentElement;
      if (!bar || bar.querySelector(`[data-account-tab="${TAB}"]`)) continue;

      const clone = item.cloneNode(true);
      const button = clone.matches("[data-account-tab]")
        ? clone
        : clone.querySelector("[data-account-tab]");
      if (!button) continue;

      button.setAttribute("data-account-tab", TAB);
      button.setAttribute("aria-selected", "false");
      button.textContent = t("navLists");
      button.addEventListener("click", (event) => {
        event.preventDefault();
        activate();
      });

      item.insertAdjacentElement("afterend", clone);
    }

    return Boolean(document.querySelector(`[data-account-tab="${TAB}"]`));
  }

  /**
   * The theme re-renders the tab bar (the account app is client-side), which
   * silently drops our tab. Watch for that and put it back.
   */
  function keepTabAlive() {
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        const bars = document.querySelectorAll('[data-account-tab="rewards"]').length;
        const ours = document.querySelectorAll(`[data-account-tab="${TAB}"]`).length;
        if (ours < bars) addTab();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /** The same tab, for the mobile popover, where the items are hash links. */
  function addPopoverLink() {
    const template = document.querySelector('a[href$="#rewards"]');
    if (!template || document.querySelector("[data-hs-nav]")) return;

    const link = template.cloneNode(true);
    link.setAttribute("data-hs-nav", "");
    link.setAttribute("href", ROUTE);
    const label = link.querySelector("span") ?? link;
    label.textContent = t("navLists");
    label.removeAttribute("aria-current");

    template.insertAdjacentElement("afterend", link);
  }

  /**
   * Our panel is a sibling of the theme's own, using its is-tab-hidden class,
   * so the site's tab switching keeps working and we don't hide its content.
   */
  function addPanel() {
    const sample = document.querySelector("[data-account-panel]");
    if (!sample) return null;

    let panel = document.querySelector(`[data-account-panel="${TAB}"]`);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.className = "account is-tab-hidden";
    panel.setAttribute("data-account-panel", TAB);

    /* Matches the width of the theme's own panels. */
    const container = document.createElement("div");
    container.className = "container container--small";
    root = document.createElement("div");
    root.className = "hs-root";
    container.appendChild(root);
    panel.appendChild(container);

    sample.parentElement.appendChild(panel);
    return panel;
  }

  function setActive(active) {
    document.documentElement.classList.toggle("hs-lists-active", active);

    for (const panel of document.querySelectorAll("[data-account-panel]")) {
      const mine = panel.getAttribute("data-account-panel") === TAB;
      if (mine) panel.classList.toggle("is-tab-hidden", !active);
      else if (active) panel.classList.add("is-tab-hidden");
    }
    for (const tab of document.querySelectorAll("[data-account-tab]")) {
      const mine = tab.getAttribute("data-account-tab") === TAB;
      tab.setAttribute("aria-selected", String(mine && active));
    }
  }

  function activate() {
    setActive(true);
    /* replaceState, not location.hash: bookmarkable without firing hashchange
       back at us. */
    if (location.hash !== ROUTE) history.replaceState(null, "", ROUTE);
    render();
  }

  /* ---------- data ---------- */

  /**
   * Resolves a stored key back to something displayable. For a Flavor product
   * the flavor IS the variant, so the row is named after it ("Grapefruit",
   * with "3er Box Syrup" underneath). For everything else the product is the
   * flavor, and a saved variant only shows when it isn't the default one —
   * that's how "the shaker bundle" stays distinguishable in Später.
   */
  async function rowsFor(listId) {
    const lists = await HS.storage.lists();
    const entries = lists[listId] ?? [];

    const settled = await Promise.allSettled(
      entries.map(async (entry) => {
        const { handle, flavor } = HS.shopify.parseKey(entry.key);
        const product = await HS.shopify.product(handle);
        const variant = HS.shopify.pickVariant(product, {
          flavor,
          later: entry.lv ?? null
        });

        const isDefault = variant && variant.id === product.variants[0]?.id;

        return {
          key: entry.key,
          ts: entry.ts,
          note: entry.note,
          title: product.flavorOption && variant ? variant.title : product.title,
          subtitle: product.flavorOption
            ? product.title
            : !isDefault && variant
              ? variant.title
              : "",
          price: variant?.price ?? 0,
          servings: variant?.servings ?? null,
          available: variant ? variant.available : product.available,
          image: variant?.image ?? product.image,
          url: variant ? `${product.url}?variant=${variant.id}` : product.url
        };
      })
    );

    return settled
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
  }

  async function counts() {
    const lists = await HS.storage.lists();
    return Object.fromEntries(
      Object.entries(lists).map(([id, entries]) => [id, entries.length])
    );
  }

  /* ---------- rendering ---------- */

  function relative(timestamp) {
    if (!timestamp) return "";
    const days = Math.floor((Date.now() - timestamp) / 86400000);
    if (days <= 0) return t("today");
    if (days === 1) return t("yesterday");
    if (days < 30) return t("daysAgo", { count: days });
    const months = Math.round(days / 30);
    return months === 1 ? t("monthAgo") : t("monthsAgo", { count: months });
  }

  function countLabel(n) {
    return n === 1 ? t("flavorCountOne") : t("flavorCount", { count: n });
  }

  async function renderOverview() {
    const total = await counts();

    const section = document.createElement("section");
    const heading = document.createElement("h2");
    heading.className = "hs-heading";
    heading.textContent = t("listsHeading");
    section.appendChild(heading);

    const hint = document.createElement("p");
    hint.className = "hs-hint";
    hint.textContent = t("syncHint");
    section.appendChild(hint);

    const grid = document.createElement("div");
    grid.className = "hs-cards";

    for (const list of LISTS) {
      const rows = await rowsFor(list.id);

      const card = document.createElement("button");
      card.type = "button";
      card.className = "hs-card" + (list.muted ? " hs-card--muted" : "");

      const collage = document.createElement("div");
      collage.className = "hs-collage";
      for (let index = 0; index < 4; index += 1) {
        const product = rows[index];
        if (product?.image) {
          const image = document.createElement("img");
          image.src = product.image;
          image.alt = "";
          image.loading = "lazy";
          collage.appendChild(image);
        } else {
          collage.appendChild(document.createElement("div"));
        }
      }
      card.appendChild(collage);

      const body = document.createElement("div");
      body.className = "hs-card-body";
      const title = document.createElement("span");
      title.className = "hs-card-title";
      title.appendChild(HS.icon(list.icon, 18));
      title.appendChild(document.createElement("span")).textContent = t(list.label);
      const meta = document.createElement("span");
      meta.className = "hs-card-meta";
      meta.textContent = countLabel(total[list.id] ?? 0);
      body.append(title, meta);
      card.appendChild(body);

      card.addEventListener("click", () => {
        view = { list: list.id, sort: "added", direction: 1 };
        render();
      });

      grid.appendChild(card);
    }

    section.appendChild(grid);
    return section;
  }

  async function renderDetail(listId) {
    const list = LISTS.find((item) => item.id === listId);
    const rows = await rowsFor(listId);

    const sort = SORTS.find((item) => item.id === view.sort);
    rows.sort((a, b) => {
      const left = sort.key(a);
      const right = sort.key(b);
      return (left < right ? -1 : left > right ? 1 : 0) * view.direction;
    });

    const section = document.createElement("section");

    const back = document.createElement("button");
    back.type = "button";
    back.className = "hs-back";
    back.appendChild(HS.icon("back", 15));
    back.appendChild(document.createElement("span")).textContent = t("allLists");
    back.addEventListener("click", () => {
      view = { ...view, list: null };
      render();
    });
    section.appendChild(back);

    const heading = document.createElement("h2");
    heading.className = "hs-heading hs-heading--detail";
    heading.appendChild(HS.icon(list.icon, 26));
    heading.appendChild(document.createElement("span")).textContent = t(list.label);
    section.appendChild(heading);

    const sortbar = document.createElement("div");
    sortbar.className = "hs-sortbar";
    const sortLabel = document.createElement("span");
    sortLabel.textContent = t("sortLabel");
    sortbar.appendChild(sortLabel);

    for (const option of SORTS) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "hs-chip";
      const active = option.id === view.sort;
      chip.setAttribute("aria-pressed", String(active));
      chip.textContent = t(option.label);
      if (active) {
        const arrow = document.createElement("span");
        arrow.className = "hs-dir";
        arrow.textContent = view.direction === 1 ? "▼" : "▲";
        chip.appendChild(arrow);
      }
      chip.addEventListener("click", () => {
        view =
          option.id === view.sort
            ? { ...view, direction: -view.direction }
            : { ...view, sort: option.id, direction: 1 };
        render();
      });
      sortbar.appendChild(chip);
    }
    section.appendChild(sortbar);

    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "hs-empty";
      empty.appendChild(document.createElement("p")).textContent = t("emptyList");
      empty.appendChild(document.createElement("p")).textContent = t("emptyHint");
      section.appendChild(empty);
      return section;
    }

    const table = document.createElement("div");
    table.className = "hs-rows";
    for (const product of rows) table.appendChild(renderRow(product, listId));
    section.appendChild(table);

    return section;
  }

  function renderRow(product, listId) {
    const row = document.createElement("div");
    row.className = "hs-row";

    if (product.image) {
      const image = document.createElement("img");
      image.src = product.image;
      image.alt = "";
      image.loading = "lazy";
      row.appendChild(image);
    } else {
      row.appendChild(document.createElement("div"));
    }

    const main = document.createElement("div");
    main.className = "hs-row-main";

    const title = document.createElement("a");
    title.className = "hs-row-title";
    title.href = product.url;
    title.textContent = product.title;
    main.appendChild(title);

    if (product.subtitle) {
      const subtitle = document.createElement("span");
      subtitle.className = "hs-row-sub";
      subtitle.textContent = product.subtitle;
      main.appendChild(subtitle);
    }

    const meta = document.createElement("span");
    meta.className = "hs-row-meta";
    const price = document.createElement("span");
    price.textContent = product.servings
      ? `${HS.shopify.money(product.price)} · ${t("perServing", {
          price: HS.shopify.money(product.price / product.servings)
        })}`
      : HS.shopify.money(product.price);
    meta.appendChild(price);

    const stock = document.createElement("span");
    stock.className = "hs-badge " + (product.available ? "hs-badge--ok" : "hs-badge--out");
    stock.textContent = product.available ? t("available") : t("soldOut");
    meta.appendChild(stock);

    const when = document.createElement("span");
    when.textContent = t("addedAgo", { when: relative(product.ts) });
    meta.appendChild(when);
    main.appendChild(meta);

    main.appendChild(noteElement(product));
    row.appendChild(main);

    const actions = document.createElement("div");
    actions.className = "hs-row-actions";

    const open = document.createElement("a");
    open.className = "hs-open";
    open.href = product.url;
    open.textContent = t("openProduct");
    actions.appendChild(open);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "hs-remove";
    remove.setAttribute("aria-label", t("removeFrom", { title: product.title }));
    remove.appendChild(HS.icon("close", 17));
    remove.addEventListener("click", async () => {
      await HS.storage.removeFrom(product.key, listId);
      render();
    });
    actions.appendChild(remove);

    row.appendChild(actions);
    return row;
  }

  function noteElement(product) {
    const shown = document.createElement("button");
    shown.type = "button";
    shown.className = "hs-note" + (product.note ? "" : " hs-note--empty");
    shown.textContent = product.note || t("addNote");

    shown.addEventListener("click", () => {
      const input = document.createElement("input");
      input.className = "hs-note-input";
      input.value = product.note ?? "";
      input.placeholder = t("notePlaceholder");
      shown.replaceWith(input);
      input.focus();

      input.addEventListener("blur", async () => {
        await HS.storage.setNote(product.key, input.value);
        render();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") input.blur();
        if (event.key === "Escape") render();
      });
    });

    return shown;
  }

  /* ---------- routing ---------- */

  let renderToken = 0;

  async function render() {
    if (!root) return;
    const token = (renderToken += 1);

    const next = view.list ? await renderDetail(view.list) : await renderOverview();

    /* A newer render started while this one was awaiting product data. */
    if (token !== renderToken) return;

    root.textContent = "";
    root.appendChild(next);
  }

  /* ---------- boot ---------- */

  function boot() {
    if (!findNav()) {
      console.warn(
        "[holy-shelf] account tabs not found — no [data-account-tab] on this " +
          "page. The Lists tab was not added."
      );
      return false;
    }

    const tabAdded = addTab();
    addPopoverLink();
    const panel = addPanel();
    if (!tabAdded || !panel) return false;

    /* Delegated, because the theme owns these buttons: clicking any other tab
       puts our panel away without us knowing which one it was.
       Two things this must NOT treat as leaving the tab: clicks inside our own
       panel (cards, sort chips, notes) and clicks on our own tab. Matching
       a[href*="#"] here used to catch both and hide us mid-interaction —
       the popover's hash links are handled by hashchange instead. */
    document.addEventListener("click", (event) => {
      const inOurs = event.target.closest?.(
        `[data-account-panel="${TAB}"], [data-account-tab="${TAB}"]`
      );
      if (inOurs) return;

      const tab = event.target.closest?.("[data-account-tab]");
      if (!tab) return;
      if (tab.getAttribute("data-account-tab") !== TAB) setActive(false);
    });

    addEventListener("hashchange", () => {
      if (location.hash === ROUTE) activate();
      else setActive(false);
    });

    HS.storage.onChange(() => {
      if (location.hash === ROUTE) render();
    });

    keepTabAlive();
    if (location.hash === ROUTE) activate();
    return true;
  }

  if (!boot()) {
    /* The theme renders the account tabs client-side, so they are regularly
       not there yet when this runs. */
    const observer = new MutationObserver(() => {
      if (boot()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  }
})();
