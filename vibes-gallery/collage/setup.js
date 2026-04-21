/**
 * Collage page setup — include this once in <head> to get everything.
 *
 * Usage:
 *   <script src="/vibes-gallery/collage/setup.js"></script>
 *
 * This injects all Collage CSS, sets up body attributes for the refresh theme,
 * and loads the web components library. No other boilerplate needed.
 */
(function () {
  var base =
    document.currentScript.src.replace(/setup\.js$/, "") ||
    "/collage/";
  var dist = base + "dist/";

  // Inject CSS (synchronous via document.write to avoid FOUC)
  var css = [
    dist + "collage-web-components.css",
    dist + "collage-utilities.css",
    dist + "refresh.css",
  ];
  css.forEach(function (href) {
    document.write('<link rel="stylesheet" href="' + href + '">');
  });

  // Load web components JS (also exposes window.Collage utilities)
  document.write('<script src="' + dist + 'collage-web-components.js"><\/script>');

  // Set up body attributes when DOM is ready
  document.addEventListener("DOMContentLoaded", function () {
    document.body.classList.add("wt-text-body");
    document.body.setAttribute("data-clg-theme", "refresh");
    document.body.setAttribute("data-clg-mode", "light");
  });
})();
