(function () {
  const HS = (globalThis.HolyShelf ||= {});
  const NS = "http://www.w3.org/2000/svg";

  /* Built as DOM nodes rather than an innerHTML string: web-ext lint flags
     every innerHTML assignment, and AMO review treats them as something to
     justify. Nothing here is worth arguing about. */
  const SHAPES = {
    heart: [
      [
        "path",
        {
          d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
        }
      ]
    ],
    up: [
      [
        "path",
        {
          d: "M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
        }
      ]
    ],
    down: [
      [
        "path",
        {
          d: "M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"
        }
      ]
    ],
    clock: [
      ["circle", { cx: 12, cy: 12, r: 10 }],
      ["path", { d: "M12 6v6l4 2" }]
    ],
    close: [["path", { d: "M6 6l12 12M18 6L6 18" }]],
    back: [["path", { d: "M15 5l-7 7 7 7" }]]
  };

  /** Which icon stands for which rating, wherever a rating is shown. */
  HS.RATING_ICON = { favorite: "heart", like: "up", dislike: "down" };

  /** Returns an <svg> element, ready to append. */
  HS.icon = function icon(name, size = 20) {
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "hs-ico");
    svg.setAttribute("width", String(size));
    svg.setAttribute("height", String(size));
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "2");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    svg.setAttribute("aria-hidden", "true");

    for (const [tag, attributes] of SHAPES[name]) {
      const shape = document.createElementNS(NS, tag);
      for (const [key, value] of Object.entries(attributes)) {
        shape.setAttribute(key, String(value));
      }
      svg.appendChild(shape);
    }

    return svg;
  };
})();
