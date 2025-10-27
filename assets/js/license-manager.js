(() => {
  const STORAGE_KEY = 'dailypickLicenseToken';
  const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEAh6/6twZwYAI6H52/hBlVo0d83oNr4kRnR8r3BtZhnOBzkdKxCRvyb+efBgU1IY5vg1ZVLkS0UxT7ApU0i253w==\n-----END PUBLIC KEY-----`;
  const textDecoder = new TextDecoder();

  const listeners = new Set();
  let publicKeyPromise = null;
  let readyResolver = null;

  const state = {
    status: 'checking', // 'checking' | 'valid' | 'invalid' | 'empty'
    token: null,
    payload: null,
    features: [],
    error: null,
  };

  function notify() {
    listeners.forEach((listener) => {
      try {
        listener({ ...state });
      } catch (err) {
        console.error('[DailyPickLicense] listener error', err);
      }
    });
  }

  function updateState(partial) {
    Object.assign(state, partial);
    notify();
  }

  function normalizeBase64Url(value) {
    return value.replace(/-/g, '+').replace(/_/g, '/');
  }

  function base64UrlDecode(value) {
    const normalized = normalizeBase64Url(value);
    const padLength = (4 - (normalized.length % 4)) % 4;
    const padded = normalized + '='.repeat(padLength);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function stripPem(pem) {
    return pem
      .replace(/-----BEGIN [\w ]+-----/, '')
      .replace(/-----END [\w ]+-----/, '')
      .replace(/\s+/g, '');
  }

  async function importPublicKey() {
    if (!('crypto' in window) || !window.crypto.subtle) {
      throw new Error('Web Crypto API not supported in this browser.');
    }
    if (!publicKeyPromise) {
      publicKeyPromise = (async () => {
        const binaryDer = base64UrlDecode(stripPem(PUBLIC_KEY_PEM));
        return crypto.subtle.importKey(
          'spki',
          binaryDer.buffer,
          { name: 'ECDSA', namedCurve: 'P-256' },
          true,
          ['verify'],
        );
      })();
    }
    return publicKeyPromise;
  }

  function safeJsonParse(str) {
    try {
      return JSON.parse(str);
    } catch (err) {
      return null;
    }
  }

  function decodePayloadBytes(payloadBytes) {
    try {
      return textDecoder.decode(payloadBytes);
    } catch (err) {
      console.error('[DailyPickLicense] Failed to decode payload', err);
      return null;
    }
  }

  async function verifyToken(token) {
    const [payloadB64, signatureB64] = (token || '').split('.');
    if (!payloadB64 || !signatureB64) {
      throw new Error('Token format invalid');
    }
    const payloadBytes = base64UrlDecode(payloadB64);
    const payloadText = decodePayloadBytes(payloadBytes);
    if (!payloadText) {
      throw new Error('Payload decode failed');
    }
    const payload = safeJsonParse(payloadText);
    if (!payload) {
      throw new Error('Payload JSON invalid');
    }

    const signatureBytes = base64UrlDecode(signatureB64);
    const key = await importPublicKey();
    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      key,
      signatureBytes,
      payloadBytes,
    );

    if (!verified) {
      throw new Error('Signature verification failed');
    }

    if (payload.exp) {
      const expires = Date.parse(payload.exp);
      if (Number.isNaN(expires)) {
        throw new Error('Expiration date invalid');
      }
      if (Date.now() > expires) {
        throw new Error('License has expired');
      }
    }

    const features = Array.isArray(payload.features) ? payload.features : [];

    return { payload, features };
  }

  async function activate(token) {
    if (!token) {
      updateState({ status: 'invalid', token: null, payload: null, features: [], error: 'Enter a license code to activate.' });
      return { success: false, error: 'Token missing' };
    }
    updateState({ status: 'checking', error: null });
    try {
      const { payload, features } = await verifyToken(token.trim());
      localStorage.setItem(STORAGE_KEY, token.trim());
      updateState({ status: 'valid', token: token.trim(), payload, features, error: null });
      return { success: true, payload };
    } catch (err) {
      console.warn('[DailyPickLicense] Activation failed', err);
      updateState({ status: 'invalid', token: null, payload: null, features: [], error: err.message || 'Activation failed' });
      localStorage.removeItem(STORAGE_KEY);
      return { success: false, error: err.message || 'Activation failed' };
    }
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    updateState({ status: 'empty', token: null, payload: null, features: [], error: null });
  }

  function isFeatureEnabled(featureName) {
    return state.features.includes(featureName);
  }

  function getState() {
    return { ...state };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    listener({ ...state });
    return () => listeners.delete(listener);
  }

  async function bootstrap() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      updateState({ status: 'empty', token: null, payload: null, features: [], error: null });
      if (readyResolver) readyResolver();
      return;
    }
    try {
      const { payload, features } = await verifyToken(stored.trim());
      updateState({ status: 'valid', token: stored.trim(), payload, features, error: null });
    } catch (err) {
      console.warn('[DailyPickLicense] Stored token invalid', err);
      updateState({ status: 'invalid', token: null, payload: null, features: [], error: err.message || 'Stored token invalid' });
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      if (readyResolver) readyResolver();
    }
  }

  const readyPromise = new Promise((resolve) => {
    readyResolver = resolve;
  });

  window.DailyPickLicense = {
    activate,
    clear,
    getState,
    isFeatureEnabled,
    subscribe,
    ready: readyPromise,
  };

  bootstrap();
})();
