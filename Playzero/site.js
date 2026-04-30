(function () {
  function getValue(source, path) {
    return path.split(".").reduce(function (value, key) {
      if (value && Object.prototype.hasOwnProperty.call(value, key)) {
        return value[key];
      }

      return undefined;
    }, source);
  }

  function bindText(data) {
    document.querySelectorAll("[data-text]").forEach(function (node) {
      var value = getValue(data, node.dataset.text);

      if (typeof value !== "undefined") {
        node.textContent = value;
      }
    });
  }

  function bindHref(data) {
    document.querySelectorAll("[data-href]").forEach(function (node) {
      var value = getValue(data, node.dataset.href);

      if (typeof value !== "undefined") {
        node.setAttribute("href", value);
      }
    });
  }

  var data = window.SITE_DATA;

  if (!data) {
    return;
  }

  bindText(data);
  bindHref(data);
})();
