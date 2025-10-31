const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const ALLOWED_SERVICES = new Set(['jira', 'trello', 'github']);
const STORAGE_KEY = 'config';
const INTERNAL_HOSTNAME = 'integrations.internal';

function sanitizeString(value, max = 160) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, max);
}

function maskToken(token = '') {
  if (!token) {
    return '';
  }
  const trimmed = token.trim();
  if (trimmed.length <= 4) {
    return `••••${trimmed}`;
  }
  return `••••${trimmed.slice(-4)}`;
}

export class IntegrationConfig {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async #loadConfig() {
    const stored = await this.state.storage.get(STORAGE_KEY);
    if (stored && typeof stored === 'object') {
      return stored;
    }
    return { services: {} };
  }

  async #persistConfig(config) {
    await this.state.storage.put(STORAGE_KEY, config);
  }

  #jsonResponse(body, status = 200) {
    const headers = new Headers({ ...CORS_HEADERS, 'Content-Type': 'application/json' });
    return new Response(JSON.stringify(body), { status, headers });
  }

  #emptyResponse(status = 204) {
    return new Response(null, { status, headers: CORS_HEADERS });
  }

  #sanitizeConfigForClient(config) {
    const safe = { services: {} };
    for (const [service, details] of Object.entries(config.services || {})) {
      const entry = details || {};
      safe.services[service] = {
        enabled: Boolean(entry.enabled),
        resource: sanitizeString(entry.resource, 160),
        syncPlayers: Boolean(entry.syncPlayers),
        storeAssignments: Boolean(entry.storeAssignments),
        tokenPreview: maskToken(entry.token),
        hasToken: Boolean(entry.token && entry.token.trim()),
        lastUpdated: entry.lastUpdated || null,
        fields: this.#sanitizeFields(entry.fields),
      };
    }
    return safe;
  }

  #sanitizeFields(fields) {
    if (!fields || typeof fields !== 'object') {
      return {};
    }
    const cleaned = {};
    for (const [key, value] of Object.entries(fields)) {
      cleaned[key] = sanitizeString(value, 160);
    }
    return cleaned;
  }

  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return this.#emptyResponse();
    }

    const url = new URL(request.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const configIndex = segments.indexOf('config');
    const rest = configIndex >= 0 ? segments.slice(configIndex + 1) : [];
    const service = rest[0];
    const isInternal = url.hostname === INTERNAL_HOSTNAME;

    if (service && !ALLOWED_SERVICES.has(service)) {
      return this.#jsonResponse({ error: 'Service not supported.' }, 404);
    }

    switch (request.method.toUpperCase()) {
      case 'GET':
        return this.#handleGet(service, isInternal && url.searchParams.get('includeSecrets') === '1');
      case 'PUT':
        return this.#handlePut(service, request);
      case 'DELETE':
        return this.#handleDelete(service);
      default:
        return this.#jsonResponse({ error: 'Method not allowed.' }, 405);
    }
  }

  async #handleGet(service, includeSecrets = false) {
    const config = await this.#loadConfig();
    if (includeSecrets) {
      if (service) {
        return this.#jsonResponse({ service, config: config.services?.[service] || null });
      }
      return this.#jsonResponse(config);
    }

    const safe = this.#sanitizeConfigForClient(config);
    if (service) {
      return this.#jsonResponse({ service, config: safe.services[service] || null });
    }

    return this.#jsonResponse(safe);
  }

  async #handlePut(service, request) {
    if (!service) {
      return this.#jsonResponse({ error: 'Service is required.' }, 400);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return this.#jsonResponse({ error: 'Invalid JSON payload.' }, 400);
    }

    const config = await this.#loadConfig();
    const existing = config.services?.[service] || {};

    const next = {
      enabled: payload.enabled === true,
      resource: sanitizeString(payload.resource, 160),
      syncPlayers: payload.syncPlayers === true,
      storeAssignments: payload.storeAssignments === true,
      token: existing.token,
      lastUpdated: new Date().toISOString(),
      fields: this.#sanitizeFields(payload.fields || existing.fields),
    };

    if (typeof payload.token === 'string' && payload.token.trim().length) {
      next.token = payload.token.trim();
    }

    if (!next.enabled && !next.token) {
      // When disabled and no token, treat as disconnected.
      if (config.services && service in config.services) {
        delete config.services[service];
      }
      await this.#persistConfig(config);
      const safe = this.#sanitizeConfigForClient(config);
      return this.#jsonResponse({ service, config: safe.services[service] || null });
    }

    if (!config.services) {
      config.services = {};
    }
    config.services[service] = next;
    await this.#persistConfig(config);

    const safe = this.#sanitizeConfigForClient(config);
    return this.#jsonResponse({ service, config: safe.services[service] || null });
  }

  async #handleDelete(service) {
    if (!service) {
      return this.#jsonResponse({ error: 'Service is required.' }, 400);
    }

    const config = await this.#loadConfig();
    if (config.services && service in config.services) {
      delete config.services[service];
    }
    await this.#persistConfig(config);

    const safe = this.#sanitizeConfigForClient(config);
    return this.#jsonResponse({ service, config: null, state: safe });
  }
}
