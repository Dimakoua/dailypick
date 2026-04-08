document.addEventListener("DOMContentLoaded", function () {
  const urlParams = new URLSearchParams(window.location.search);
  const embedParam = urlParams.get("embed");
  const embeddedInIframe = window.self !== window.top;
  const embedMode = embeddedInIframe || embedParam === "1" || embedParam === "true";
  const embedSection = document.getElementById("embedSection");
  const embedCodeTextarea = document.getElementById("embedCode");
  const copyEmbedBtn = document.getElementById("copyEmbedBtn");

  if (embedMode) {
    document.body.classList.add("embed-mode");
    if (embedSection) {
      embedSection.style.display = "none";
    }
    document.querySelectorAll(
      ".seo-content-area, .info-card, .page-hero, .embed-section, .site-header, .site-footer, .cookie-consent, .bg-orbs, .standup-panel, .standup-dock, .standup-dock-toggle, .standup-only-link, .standup-section, .standup-queue, .standup-panel__header, .standup-panel__content, .standup-panel__services"
    ).forEach(function (element) {
      element.style.display = "none";
      element.style.visibility = "hidden";
      element.style.height = "0";
      element.style.margin = "0";
      element.style.padding = "0";
      element.style.overflow = "hidden";
    });
  }

  if (embedCodeTextarea) {
    const embedSrc = `${window.location.origin}${window.location.pathname}?embed=1`;
    embedCodeTextarea.value = `<iframe src="${embedSrc}" width="100%" height="700" style="border:none;overflow:hidden;border-radius:24px;" loading="lazy"></iframe>`;
  }

  if (copyEmbedBtn && embedCodeTextarea) {
    copyEmbedBtn.addEventListener("click", function () {
      embedCodeTextarea.select();
      navigator.clipboard.writeText(embedCodeTextarea.value).then(function () {
        const originalText = copyEmbedBtn.textContent;
        copyEmbedBtn.textContent = "Copied!";
        setTimeout(function () {
          copyEmbedBtn.textContent = originalText;
        }, 1500);
      });
    });
  }
});
