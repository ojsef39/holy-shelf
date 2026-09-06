/**
 * Rating badges on collection grid tiles, so you can see what you have already
 * judged while scrolling sixty flavors instead of opening each one.
 *
 * Anchored on the product link and the <product-item> element that wraps it,
 * never on generated class names. Tiles are marked once painted: the grid
 * paginates and lazy-loads, so we watch for new tiles, and skipping painted
 * ones is also what stops our own insertions from re-triggering the observer.
 */
(function () {
  const HS = globalThis.HolyShelf;

  /* /collections/<c>/products/<p> is a product page — product.js owns that. */
  if (location.pathname.includes("/products/")) return;

  const PAINTED = "data-hs-badged";

  function tileOf(link) {
    return link.closest("product-item, li, article") ?? link;
  }

  /* One fetch per product, however many of its flavors are on the page. */
  const products = new Map();
  function productFor(handle) {
    if (!products.has(handle)) {
      products.set(
        handle,
        HS.shopify.product(handle).catch(() => null)
      );
    }
    return products.get(handle);
  }

  /**
   * A syrup collection lists one tile PER FLAVOR, all pointing at the same
   * product with a different ?variant=. So a tile is not always a product, and
   * the variant is what says which flavor it stands for.
   */
  async function keyFor(handle, variantId) {
    if (!variantId) return { key: handle, variant: null };

    const product = await productFor(handle);
    if (!product) return { key: handle, variant: null };

    const variant = product.variants.find((each) => each.id === variantId) ?? null;
    return { key: HS.shopify.key(product, variant), variant };
  }

  async function paintNew() {
    const { items } = await HS.storage.read();

    const fresh = [];
    for (const link of document.querySelectorAll('a[href*="/products/"]')) {
      const href = link.getAttribute("href") ?? "";
      const handle = /\/products\/([^/?#]+)/.exec(href)?.[1];
      if (!handle) continue;

      const tile = tileOf(link);
      if (tile.hasAttribute(PAINTED)) continue;
      tile.setAttribute(PAINTED, "");

      const query = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
      const variantId = Number(new URLSearchParams(query).get("variant")) || null;
      fresh.push({ tile, handle, variantId });
    }

    await Promise.all(
      fresh.map(async ({ tile, handle, variantId }) => {
        const { key, variant } = await keyFor(handle, variantId);
        const entry = items[key];
        if (!entry) return;

        const badge = document.createElement("span");
        badge.className = "hs-tile-badge";
        if (entry.r) badge.appendChild(HS.icon(HS.RATING_ICON[entry.r], 13));
        if (HS.storage.laterMatches(entry, variant)) {
          badge.appendChild(HS.icon("clock", 13));
        }
        if (!badge.hasChildNodes()) return;

        tile.classList.add("hs-badge-host");
        tile.appendChild(badge);
      })
    );
  }

  function repaintAll() {
    for (const tile of document.querySelectorAll(`[${PAINTED}]`)) {
      tile.removeAttribute(PAINTED);
      tile.classList.remove("hs-badge-host");
      tile.querySelector(":scope > .hs-tile-badge")?.remove();
    }
    paintNew();
  }

  paintNew();
  HS.storage.onChange(repaintAll);

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => {
      queued = false;
      paintNew();
    }, 200);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
