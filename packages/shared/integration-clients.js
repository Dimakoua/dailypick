const DEFAULT_TIMEOUT = 15000;

export class IntegrationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'IntegrationError';
    this.status = status;
  }
}

async function fetchWithTimeout(url, options = {}, timeout = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

function assertConfig(service, config) {
  if (!config || typeof config !== 'object') {
    throw new IntegrationError(`No saved configuration for ${service}.`, 404);
  }
  if (!config.enabled) {
    throw new IntegrationError(`${service} integration is disabled.`, 409);
  }
  if (!config.token) {
    throw new IntegrationError(`Missing ${service} access token.`, 412);
  }
  return config;
}

function ensureFields(config) {
  return config.fields && typeof config.fields === 'object' ? config.fields : {};
}

async function fetchJira(config, payload = {}) {
  assertConfig('jira', config);
  const fields = ensureFields(config);
  const siteUrl = (fields.siteUrl || '').trim().replace(/\/$/, '');
  const email = (fields.email || '').trim();
  const projectKey = (config.resource || '').trim();

  if (!siteUrl) {
    throw new IntegrationError('Jira site URL is required.', 422);
  }
  if (!email) {
    throw new IntegrationError('Jira account email is required for API access.', 422);
  }
  if (!projectKey) {
    throw new IntegrationError('Jira project key is required.', 422);
  }

  const query = payload.query || `project=${projectKey} ORDER BY updated DESC`;
  const url = new URL(`${siteUrl}/rest/api/3/search`);
  url.searchParams.set('jql', query);
  url.searchParams.set('maxResults', payload.maxResults ? String(payload.maxResults) : '20');

  const auth = btoa(`${email}:${config.token}`);
  const response = await fetchWithTimeout(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new IntegrationError(`Jira request failed: ${response.status} ${text}`.trim(), response.status);
  }

  const data = await response.json();
  const issues = Array.isArray(data.issues)
    ? data.issues.map((issue) => ({
        id: issue.id,
        key: issue.key,
        summary: issue.fields?.summary ?? '',
        status: issue.fields?.status?.name ?? '',
        assignee: issue.fields?.assignee?.displayName ?? null,
        updated: issue.fields?.updated ?? null,
      }))
    : [];

  return {
    query,
    issues,
    total: data.total ?? issues.length,
  };
}

function extractTrelloBoardId(resource) {
  if (!resource) return '';
  const trimmed = resource.trim();
  if (/^[a-zA-Z0-9]{8,}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[1] || '';
  } catch {
    return '';
  }
}

async function fetchTrello(config) {
  assertConfig('trello', config);
  const fields = ensureFields(config);
  const boardId = extractTrelloBoardId(config.resource || '');
  const apiKey = (fields.apiKey || '').trim();

  if (!boardId) {
    throw new IntegrationError('Trello board URL or ID is required.', 422);
  }
  if (!apiKey) {
    throw new IntegrationError('Trello API key is required.', 422);
  }

  const url = new URL(`https://api.trello.com/1/boards/${boardId}/cards`);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('token', config.token.trim());
  url.searchParams.set('fields', 'id,name,url,idList,pos');
  url.searchParams.set('limit', '50');

  const response = await fetchWithTimeout(url.toString(), { method: 'GET' });
  if (!response.ok) {
    const text = await response.text();
    throw new IntegrationError(`Trello request failed: ${response.status} ${text}`.trim(), response.status);
  }

  const cards = await response.json();
  const normalized = Array.isArray(cards)
    ? cards.map((card) => ({
        id: card.id,
        name: card.name,
        url: card.url,
        listId: card.idList,
        position: card.pos,
      }))
    : [];

  return {
    boardId,
    cards: normalized,
    count: normalized.length,
  };
}

async function fetchGitHub(config, payload = {}) {
  assertConfig('github', config);
  const repo = (config.resource || '').trim();
  if (!repo || !repo.includes('/')) {
    throw new IntegrationError('GitHub repository must be in the form owner/repo.', 422);
  }

  const perPage = payload.perPage ? Math.min(Math.max(parseInt(payload.perPage, 10), 1), 100) : 20;
  const url = new URL(`https://api.github.com/repos/${repo}/issues`);
  url.searchParams.set('per_page', String(perPage));
  if (payload.state) {
    url.searchParams.set('state', payload.state);
  } else {
    url.searchParams.set('state', 'open');
  }

  const response = await fetchWithTimeout(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${config.token.trim()}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'DailyPick-Worker',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new IntegrationError(`GitHub request failed: ${response.status} ${text}`.trim(), response.status);
  }

  const issues = await response.json();
  const normalized = Array.isArray(issues)
    ? issues
        .filter((issue) => !issue.pull_request)
        .map((issue) => ({
          id: issue.id,
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
          state: issue.state,
          assignee: issue.assignee?.login ?? null,
          updated: issue.updated_at,
        }))
    : [];

  return {
    repository: repo,
    issues: normalized,
    count: normalized.length,
  };
}

export async function fetchIntegrationData(service, config, payload = {}) {
  switch (service) {
    case 'jira':
      return fetchJira(config, payload);
    case 'trello':
      return fetchTrello(config, payload);
    case 'github':
      return fetchGitHub(config, payload);
    default:
      throw new IntegrationError(`Unsupported service: ${service}.`, 404);
  }
}
