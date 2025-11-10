document.addEventListener('DOMContentLoaded', () => {
    const whatsNewPopup = document.getElementById('whats-new-popup');
    const closeButton = document.getElementById('whats-new-close');
    const LATEST_FEATURE_VERSION = '1.0.0'; // Increment this to show the popup again

    const hasSeenLatestFeature = () => {
        const seenVersion = localStorage.getItem('whatsNewSeenVersion');
        return seenVersion === LATEST_FEATURE_VERSION;
    };

    const setSeenLatestFeature = () => {
        localStorage.setItem('whatsNewSeenVersion', LATEST_FEATURE_VERSION);
    };

    if (!hasSeenLatestFeature()) {
        whatsNewPopup.style.display = 'block';
    }

    whatsNewPopup.addEventListener('click', (e) => {
        if (e.target === closeButton) {
            return;
        }
        whatsNewPopup.classList.toggle('expanded');
    });

    closeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        whatsNewPopup.style.display = 'none';
        setSeenLatestFeature();
    });
});
