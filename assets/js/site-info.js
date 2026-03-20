(() => {
  const dataUrl = "assets/data/site.json";
  const fallback = { contactEmail: "hello@donut.studio" };

  const apply = (data) => {
    const email = data.contactEmail || data.contact_email || data.email || fallback.contactEmail;
    if (!email) {
      return;
    }

    document.querySelectorAll("[data-site='contact-email']").forEach((el) => {
      el.textContent = email;
    });

    document.querySelectorAll("[data-site='contact-email-link']").forEach((el) => {
      el.textContent = email;
      el.setAttribute("href", `mailto:${email}`);
    });
  };

  fetch(dataUrl)
    .then((response) => (response.ok ? response.json() : Promise.reject()))
    .then(apply)
    .catch(() => apply(fallback));
})();
