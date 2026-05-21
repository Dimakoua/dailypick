(function() {
    'use strict';

    function sendFeatureEvent(eventName, params) {
        var payload = Object.assign({ event: eventName }, params || {});

        if (typeof window.gtag === 'function') {
            window.gtag('event', eventName, params || {});
            return;
        }

        if (window.dataLayer && Array.isArray(window.dataLayer)) {
            window.dataLayer.push(payload);
            return;
        }

        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(payload);
    }

    function trackFeatureEvent(eventName, params) {
        if (!eventName) return;
        sendFeatureEvent(eventName, params);
    }

    window.trackFeatureEvent = trackFeatureEvent;
})();
