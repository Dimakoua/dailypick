const GTAG_ID = "G-N83YF635W2";
const CONSENT_KEY = "dailyPickCookieConsent";

function loadGoogleTag() {
  if (window.gtagInitialized) {
    return;
  }

  const existingScript = document.querySelector("script[data-gtag]");
  if (existingScript) {
    const currentSrc = existingScript.getAttribute("src");
    if (!currentSrc) {
      const dataSrc = existingScript.dataset.gtagSrc || `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
      existingScript.src = dataSrc;
    } else if (!currentSrc.includes(GTAG_ID)) {
      existingScript.src = `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
    }
  }

  if (!existingScript || !existingScript.getAttribute("src")) {
    const gtagScript = document.createElement("script");
    gtagScript.async = true;
    gtagScript.src = `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
    gtagScript.setAttribute("data-gtag", "");
    gtagScript.dataset.gtagSrc = `https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`;
    document.head.appendChild(gtagScript);
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() {
    window.dataLayer.push(arguments);
  };

  window.gtag("js", new Date());
  window.gtag("config", GTAG_ID);
  window.gtagInitialized = true;
}

function hideBanner(banner) {
  if (!banner) return;
  banner.setAttribute("hidden", "");
  banner.classList.remove("cookie-consent--visible");
}

function showBanner(banner) {
  if (!banner) return;
  banner.classList.add("cookie-consent--visible");
  banner.removeAttribute("hidden");
}

function storeConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch (error) {
    console.warn("Unable to store cookie consent preference", error);
  }
}

function getStoredConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch (error) {
    console.warn("Unable to read cookie consent preference", error);
    return null;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const banner = document.querySelector("[data-cookie-consent]");
  if (!banner) {
    if (getStoredConsent() === "granted") {
      loadGoogleTag();
    }
    return;
  }

  const acceptBtn = banner.querySelector("[data-cookie-accept]");
  const declineBtn = banner.querySelector("[data-cookie-decline]");
  const existingConsent = getStoredConsent();

  if (existingConsent === "granted") {
    loadGoogleTag();
    hideBanner(banner);
    return;
  }

  if (existingConsent === "denied") {
    hideBanner(banner);
    return;
  }

  showBanner(banner);

  if (acceptBtn) {
    acceptBtn.addEventListener("click", () => {
      storeConsent("granted");
      loadGoogleTag();
      hideBanner(banner);
    });
  }

  if (declineBtn) {
    declineBtn.addEventListener("click", () => {
      storeConsent("denied");
      hideBanner(banner);
    });
  }
});
