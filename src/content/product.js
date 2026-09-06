(async function () {
  const HS = globalThis.HolyShelf;

  const handle = HS.shopify.handleFromUrl();
  if (!handle) return;

  const MOUNTED = "data-hs-mounted";

  let product;
  try {
    product = await HS.shopify.product(handle);
  } catch (error) {
    console.warn("[holy-shelf] product data unavailable:", error);
    return;
  }

  /** The buy box's own form — never Shop Pay's installment form. */
  function buyForm() {
    return (
      document.querySelector('form[action*="/cart/add"][is="product-form"]') ??
      document.querySelector('form[action*="/cart/add"]:not([id*="installment"])')
    );
  }

  /**
   * The theme drives variant selection with radio inputs carrying
   * data-variant, and that checked radio is the only thing that reliably
   * reflects a click. Both cart forms' hidden id inputs sit at the DEFAULT
   * variant in the served HTML, so reading those made every "later" save the
   * 50-Portionen variant no matter what was selected.
   */
  function selectedByRadio() {
    const radios = [
      ...document.querySelectorAll('input[type="radio"][data-variant]:checked')
    ];
    /* The sticky bar has its own copy of the swatches. */
    const main =
      radios.find((radio) => (radio.getAttribute("form") ?? "").includes("__main")) ??
      radios[0];
    return main ? Number(main.dataset.variant) : null;
  }

  function currentVariant() {
    const byRadio = product.variants.find((v) => v.id === selectedByRadio());
    if (byRadio) return byRadio;

    const fromUrl = Number(new URLSearchParams(location.search).get("variant"));
    const byUrl = product.variants.find((v) => v.id === fromUrl);
    if (byUrl) return byUrl;

    const fromForm = Number(buyForm()?.querySelector('input[name="id"]')?.value);
    return (
      product.variants.find((v) => v.id === fromForm) ?? product.variants[0] ?? null
    );
  }

  const context = {
    getVariant: currentVariant,
    getKey: () => HS.shopify.key(product, currentVariant())
  };

  /** True if any ancestor is pinned — that's the sticky buy bar, not the page. */
  function isPinned(element) {
    for (let node = element; node && node !== document.body; node = node.parentElement) {
      const position = getComputedStyle(node).position;
      if (position === "fixed" || position === "sticky") return true;
    }
    return false;
  }

  function findAnchor() {
    /* A product page has more than one add-to-cart button: the buy box and the
       sticky bar that slides in on scroll. Taking the first in document order
       put the control in the sticky bar. Shopify names the main section's form
       "...__main-<id>", so prefer that, then anything not pinned. */
    const buttons = [
      ...document.querySelectorAll("[data-product-add-to-cart-button], #AddToCart")
    ];

    const button =
      buttons.find((candidate) =>
        (candidate.closest("form")?.getAttribute("id") ?? "").includes("__main")
      ) ??
      buttons.find((candidate) => !isPinned(candidate)) ??
      buttons[0];

    const container =
      button?.closest("product-payment-container") ??
      button?.closest('form[action*="/cart/add"]');
    if (container) return container;

    return (
      document.querySelector('form[action*="/cart/add"][is="product-form"]') ??
      document.querySelector('form[action*="/cart/add"]:not([id*="installment"])')
    );
  }

  /**
   * Marks the variant swatches themselves. Without this, a 1-Portion saved for
   * later is invisible: the page opens on the 50-Portionen default, so you'd
   * have to click through every variant to find it — or clear it by accident.
   *
   * Ratings are only shown for a Flavor product, where each variant is its own
   * flavor. On pack sizes the rating is shared, so a badge on one swatch and
   * not another would be a lie.
   */
  async function paintVariantBadges() {
    const radios = document.querySelectorAll('input[type="radio"][data-variant]');
    if (radios.length === 0) return;

    const { items } = await HS.storage.read();

    for (const radio of radios) {
      const variant = product.variants.find(
        (candidate) => candidate.id === Number(radio.dataset.variant)
      );
      if (!variant) continue;

      const host = radio.closest(".block-swatch") ?? radio.parentElement;
      if (!host) continue;

      host.querySelector(":scope > .hs-variant-badge")?.remove();

      const entry = items[HS.shopify.key(product, variant)] ?? null;
      const badge = document.createElement("span");
      badge.className = "hs-variant-badge";

      if (product.flavorOption && entry?.r) {
        badge.appendChild(HS.icon(HS.RATING_ICON[entry.r], 12));
      }
      if (HS.storage.laterMatches(entry, variant)) {
        badge.appendChild(HS.icon("clock", 12));
      }
      if (!badge.hasChildNodes()) {
        host.classList.remove("hs-badge-host");
        continue;
      }

      host.classList.add("hs-badge-host");
      host.appendChild(badge);
    }
  }

  function mount(anchor) {
    if (anchor.hasAttribute(MOUNTED)) return;
    anchor.setAttribute(MOUNTED, "");

    const control = HS.controls.create(context);
    anchor.insertAdjacentElement("afterend", control);
    watchVariant(control);

    paintVariantBadges();
    HS.storage.onChange(paintVariantBadges);
  }

  /**
   * Re-render when the shopper picks another variant. The theme updates the
   * hidden input as a property, which fires no event and no mutation record,
   * so we re-check after interactions rather than observing the DOM.
   */
  function watchVariant(control) {
    let lastId = currentVariant()?.id ?? null;

    const check = () => {
      const nowId = currentVariant()?.id ?? null;
      if (nowId === lastId) return;
      lastId = nowId;
      control.refresh();
    };

    /* Twice: once for handlers that update synchronously, once for the ones
       that wait for a fetch before swapping the variant in. */
    const soon = () => {
      setTimeout(check, 0);
      setTimeout(check, 300);
    };

    document.addEventListener("click", soon, true);
    document.addEventListener("change", soon, true);
    addEventListener("popstate", check);
  }

  const anchor = findAnchor();
  if (anchor) {
    mount(anchor);
    return;
  }

  /* Themes hydrate the buy box late often enough to be worth waiting for.
     If it never appears, say so once — silence looks identical to "no bug". */
  const observer = new MutationObserver(() => {
    const late = findAnchor();
    if (!late) return;
    observer.disconnect();
    clearTimeout(giveUp);
    mount(late);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });

  const giveUp = setTimeout(() => {
    observer.disconnect();
    console.warn(
      "[holy-shelf] no buy box found on this product page (looked for " +
        "[data-product-add-to-cart-button], product-payment-container, then " +
        "the cart form) — the theme changed and the control was not inserted."
    );
  }, 10000);
})();
