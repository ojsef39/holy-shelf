/**
 * Message table, in browser.i18n's messages.json shape so these can move to
 * _locales/ later without rewriting the strings. We resolve the locale from the
 * storefront rather than the browser UI language, so we can't use browser.i18n
 * itself — see lib/i18n.js.
 */
(globalThis.HolyShelf ||= {}).messages ||= {};

globalThis.HolyShelf.messages.en = {
  navLists: { message: "Lists" },
  listsHeading: { message: "Lists" },
  syncHint: { message: "Stored in this browser, synced to your other devices." },

  listFavorites: { message: "Favorites" },
  listLiked: { message: "Liked" },
  listDisliked: { message: "Not for me" },
  listLater: { message: "Later" },

  flavorCount: { message: "$COUNT$ flavors" },
  flavorCountOne: { message: "1 flavor" },
  allLists: { message: "All lists" },

  sortLabel: { message: "Sort" },
  sortAdded: { message: "Recently added" },
  sortName: { message: "Name" },
  sortPrice: { message: "Price" },
  sortStock: { message: "Availability" },

  available: { message: "In stock" },
  soldOut: { message: "Sold out" },
  openProduct: { message: "Open" },
  removeFrom: { message: "Remove $TITLE$ from this list" },
  addedAgo: { message: "added $WHEN$" },
  perServing: { message: "$PRICE$/serving" },

  addNote: { message: "+ Note" },
  notePlaceholder: { message: "Note …" },

  rateFavorite: { message: "Favorite" },
  rateLiked: { message: "Like" },
  rateDisliked: { message: "Not for me" },
  saveLater: { message: "Later" },
  savedLater: { message: "Saved" },

  emptyList: { message: "Nothing here yet." },
  emptyHint: { message: "Rate a flavor on its product page and it shows up here." },
  loadFailed: { message: "Could not load product details." },

  today: { message: "today" },
  yesterday: { message: "yesterday" },
  daysAgo: { message: "$COUNT$ days ago" },
  monthAgo: { message: "a month ago" },
  monthsAgo: { message: "$COUNT$ months ago" }
};
