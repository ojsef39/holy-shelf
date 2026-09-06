/**
 * Locale resolution.
 *
 * Deliberately NOT browser.i18n: that follows the browser UI language, so an
 * English Firefox would inject English strings into de.holy.com. The storefront
 * decides the language, not the browser. Every holy.com storefront sets a
 * correct <html lang>, which is our primary source.
 */
(function () {
  const HS = (globalThis.HolyShelf ||= {});
  const api = globalThis.browser ?? globalThis.chrome;
  const FALLBACK = "en";

  function known(lang) {
    if (!lang) return null;
    const base = String(lang).toLowerCase().split("-")[0];
    return HS.messages[base] ? base : null;
  }

  function resolve() {
    return (
      known(document.documentElement.getAttribute("lang")) ||
      known(location.hostname.split(".")[0]) ||
      known(api?.i18n?.getUILanguage?.()) ||
      known(navigator.language) ||
      FALLBACK
    );
  }

  let locale = null;

  function t(key, vars) {
    locale ??= resolve();
    const entry = HS.messages[locale]?.[key] ?? HS.messages[FALLBACK][key];
    let text = entry?.message ?? key;
    if (vars) {
      for (const [name, value] of Object.entries(vars)) {
        text = text.replaceAll(`$${name.toUpperCase()}$`, String(value));
      }
    }
    return text;
  }

  HS.i18n = {
    t,
    get locale() {
      return (locale ??= resolve());
    },
    /** BCP-47 tag for Intl, e.g. "de-DE" on de.holy.com. */
    get tag() {
      return document.documentElement.getAttribute("lang") || this.locale;
    }
  };
})();
