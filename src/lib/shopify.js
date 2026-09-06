/**
 * Product metadata from the storefront's own JSON, and the key model.
 *
 * /products/<handle>.js is unauthenticated and returns title, price (in minor
 * units), availability, images and variants, so nothing here scrapes the DOM.
 * Prices differ per storefront, so this cache IS keyed by host, unlike the
 * verdict store in storage.js.
 *
 * KEYS. A rating is an opinion about a flavor, so it keys on something stable
 * across storefronts:
 *
 *   capybara-colada            a normal product — the flavor is the product
 *   3er-set::Grapefruit        a "Flavor" option — the flavor is the variant
 *
 * Flavor names are brand names and identical on every storefront. Portion
 * variant titles are NOT ("50 Portionen" is "50 Portions" on fr.holy.com), so
 * they must never appear in a key. That is why "later" stores its variant as
 * data instead — see storage.js.
 */
(function () {
  const HS = (globalThis.HolyShelf ||= {});
  const api = globalThis.browser ?? globalThis.chrome;

  const TTL_MS = 6 * 60 * 60 * 1000;
  const local = api.storage.local;

  const SEPARATOR = "::";
  const FLAVOR_OPTION = /^(flavou?r|geschmack|sorte)$/i;

  /* p2: the shape changed when variants were added; old entries are ignored. */
  function cacheKey(handle) {
    return `p2:${location.host}:${handle}`;
  }

  function currency() {
    return (
      document.querySelector('meta[property="og:price:currency"]')?.content ||
      "EUR"
    );
  }

  function absolute(src) {
    if (!src) return null;
    return src.startsWith("//") ? `https:${src}` : src;
  }

  /** "50 Portionen" / "50 servings" → 50, for the per-serving price. */
  function servingsOf(variantTitle) {
    const match = /(\d+)/.exec(variantTitle ?? "");
    return match ? Number(match[1]) : null;
  }

  async function fetchFresh(handle) {
    const url = `${location.origin}/products/${encodeURIComponent(handle)}.js`;
    const response = await fetch(url, { credentials: "omit" });
    if (!response.ok) throw new Error(`${url} → ${response.status}`);
    const json = await response.json();

    const optionNames = (json.options ?? []).map((option) =>
      typeof option === "string" ? option : (option?.name ?? "")
    );

    return {
      handle: json.handle,
      title: json.title,
      url: json.url,
      available: Boolean(json.available),
      image: absolute(json.featured_image ?? json.images?.[0] ?? null),
      /* When the option is named Flavor, each variant is its own flavor and
         deserves its own rating; otherwise variants are just pack sizes. */
      flavorOption: optionNames.some((name) => FLAVOR_OPTION.test(String(name).trim())),
      variants: (json.variants ?? []).map((variant) => ({
        id: variant.id,
        title: variant.title,
        /* Minor units — /products/x.js returns 3999, unlike products.json. */
        price: variant.price,
        available: Boolean(variant.available),
        servings: servingsOf(variant.title),
        image: absolute(variant.featured_image?.src ?? null)
      }))
    };
  }

  HS.shopify = {
    SEPARATOR,

    async product(handle) {
      const key = cacheKey(handle);
      try {
        const hit = (await local.get(key))[key];
        if (hit && Date.now() - hit.at < TTL_MS) return hit.data;
      } catch {
        /* Cache read failures are not worth failing the render over. */
      }

      const data = await fetchFresh(handle);
      try {
        await local.set({ [key]: { at: Date.now(), data } });
      } catch {
        /* Same: a full local cache shouldn't break the page. */
      }
      return data;
    },

    /** The handle of the product page we're on, or null. */
    handleFromUrl() {
      return /\/products\/([^/?#]+)/.exec(location.pathname)?.[1] ?? null;
    },

    /** The storage key for a flavor: variant-aware only for Flavor options. */
    key(product, variant) {
      return product.flavorOption && variant
        ? product.handle + SEPARATOR + variant.title
        : product.handle;
    },

    parseKey(key) {
      const at = key.indexOf(SEPARATOR);
      return at === -1
        ? { handle: key, flavor: null }
        : { handle: key.slice(0, at), flavor: key.slice(at + SEPARATOR.length) };
    },

    /**
     * Which variant a stored entry refers to. The flavor in the key wins; then
     * a saved "later" variant, by id and then by title, so an entry still
     * resolves on a storefront where the ids differ; then the default.
     */
    pickVariant(product, { flavor = null, later = null } = {}) {
      const variants = product.variants ?? [];

      if (flavor) {
        const byFlavor = variants.find((variant) => variant.title === flavor);
        if (byFlavor) return byFlavor;
      }

      if (later) {
        const byId = variants.find((variant) => variant.id === later.i);
        if (byId) return byId;
        const byTitle = variants.find((variant) => variant.title === later.t);
        if (byTitle) return byTitle;
      }

      return variants[0] ?? null;
    },

    money(minorUnits) {
      return new Intl.NumberFormat(HS.i18n.tag, {
        style: "currency",
        currency: currency()
      }).format(minorUnits / 100);
    }
  };
})();
