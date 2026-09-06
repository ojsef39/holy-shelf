/**
 * The product-page control: three mutually exclusive ratings in one pill, and
 * "save for later" as an independent toggle beside it. The split is the whole
 * point — wanting to buy a flavor is not the same as having an opinion on it,
 * and it runs deeper than the layout: the rating is stored against the flavor,
 * while "later" also records WHICH variant you were looking at.
 */
(function () {
  const HS = (globalThis.HolyShelf ||= {});
  const { t } = HS.i18n;

  const RATINGS = [
    { id: "favorite", icon: "heart", label: "rateFavorite" },
    { id: "like", icon: "up", label: "rateLiked" },
    { id: "dislike", icon: "down", label: "rateDisliked" }
  ];

  function button(className, iconName, text, onClick) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = className;
    element.appendChild(HS.icon(iconName));
    element.appendChild(document.createElement("span")).textContent = text;
    element.addEventListener("click", onClick);
    return element;
  }

  HS.controls = {
    /**
     * `context` supplies the current key and variant, because both change when
     * the shopper picks a different variant on the page. The returned element
     * carries a refresh() for the page to call when that happens.
     */
    create(context) {
      const root = document.createElement("div");
      root.className = "hs-controls";

      async function render() {
        const key = context.getKey();
        const entry = (await HS.storage.entry(key)) ?? {};
        root.textContent = "";

        /* Ratings and "later" share one row: the buy box is wide enough that a
           second row would be dead space. The row below stays free for custom
           lists, if they ever happen. */
        const row = document.createElement("div");
        row.className = "hs-control-row";

        const pill = document.createElement("div");
        pill.className = "hs-pill";
        for (const rating of RATINGS) {
          const segment = button("hs-seg", rating.icon, t(rating.label), async () => {
            await HS.storage.setRating(context.getKey(), rating.id);
            render();
          });
          segment.setAttribute("aria-pressed", String(entry.r === rating.id));
          pill.appendChild(segment);
        }
        row.appendChild(pill);

        /* Lit only when the selected variant is the saved one — the flavor
           being on the list is not the same as THIS variant being on it. */
        const savedHere = HS.storage.laterMatches(entry, context.getVariant());

        const later = button(
          "hs-later",
          "clock",
          savedHere ? t("savedLater") : t("saveLater"),
          async () => {
            await HS.storage.toggleLater(context.getKey(), context.getVariant());
            render();
          }
        );
        later.setAttribute("aria-pressed", String(savedHere));
        row.appendChild(later);
        root.appendChild(row);

        /* The note only exists once the flavor is on some list, so an untouched
           product page gains the pill and nothing else. */
        if (entry.r || entry.l) root.appendChild(noteRow(key, entry.n ?? ""));
      }

      function noteRow(key, note) {
        const row = document.createElement("div");
        row.className = "hs-note-row";

        const shown = document.createElement("button");
        shown.type = "button";
        shown.className = note ? "hs-note" : "hs-note-add";
        shown.textContent = note || t("addNote");
        shown.addEventListener("click", () => edit(note));
        row.appendChild(shown);

        function edit(value) {
          row.textContent = "";
          const input = document.createElement("input");
          input.className = "hs-note-input";
          input.value = value;
          input.placeholder = t("notePlaceholder");
          row.appendChild(input);
          input.focus();

          input.addEventListener("blur", async () => {
            await HS.storage.setNote(key, input.value);
            render();
          });
          input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") input.blur();
            if (event.key === "Escape") render();
          });
        }

        return row;
      }

      root.refresh = render;
      render();
      HS.storage.onChange(render);
      return root;
    }
  };
})();
