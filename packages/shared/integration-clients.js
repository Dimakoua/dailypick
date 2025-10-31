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

function uniqueStrings(values = []) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

async function fetchJira(config, payload = {}) {
  assertConfig('jira', config);
  const fields = ensureFields(config);
  const siteUrl = (fields.siteUrl || '').trim().replace(/\/$/, '');
  const email = (fields.email || '').trim();
  const projectKey = (config.resource || '').trim();
  const includeAssignments = payload.includeAssignments === true;

  if (!siteUrl) {
    throw new IntegrationError('Jira site URL is required.', 422);
  }
  if (!email) {
    throw new IntegrationError('Jira account email is required for API access.', 422);
  }
  if (!projectKey) {
    throw new IntegrationError('Jira project key is required.', 422);
  }

  const auth = btoa(`${email}:${config.token}`);
  const assignmentMap = new Map();
  let issues = [];
  let totalIssues = 0;
  const query = payload.query || `project=${projectKey} ORDER BY updated DESC`;

  if (includeAssignments) {
    const url = new URL(`${siteUrl}/rest/api/3/search`);
    url.searchParams.set('jql', query);
    url.searchParams.set('maxResults', payload.maxResults ? String(payload.maxResults) : '20');

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
    issues = Array.isArray(data.issues)
      ? data.issues.map((issue) => {
          const assignee = issue.fields?.assignee?.displayName ?? null;
          const key = issue.key;
          const issueUrl = key ? `${siteUrl}/browse/${key}` : null;
          return {
            id: issue.id,
            key,
            summary: issue.fields?.summary ?? '',
            status: issue.fields?.status?.name ?? '',
            assignee,
            updated: issue.fields?.updated ?? null,
            url: issueUrl,
          };
        })
      : [];

    totalIssues = data.total ?? issues.length;

    for (const issue of issues) {
      if (!issue.assignee) continue;
      const existing = assignmentMap.get(issue.assignee) || [];
      existing.push({
        key: issue.key,
        summary: issue.summary,
        status: issue.status,
        url: issue.url,
      });
      assignmentMap.set(issue.assignee, existing);
    }
  }

  let assignableUsers = [];
  try {
    const usersUrl = new URL(`${siteUrl}/rest/api/3/user/assignable/search`);
    usersUrl.searchParams.set('project', projectKey);
    usersUrl.searchParams.set('maxResults', payload.maxUsers ? String(payload.maxUsers) : '100');
    const usersResponse = await fetchWithTimeout(usersUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });
    if (usersResponse.ok) {
      const users = await usersResponse.json();
      if (Array.isArray(users)) {
        assignableUsers = users
          .map((user) => user.displayName || user.name || '')
          .filter(Boolean);
      }
    }
  } catch (error) {
    console.warn('Jira user fetch failed', error);
  }

  const players = uniqueStrings([
    ...assignableUsers,
    ...assignmentMap.keys(),
  ]);

  const assignments = Array.from(assignmentMap.entries()).map(([player, items]) => ({
    player,
    items,
  }));

  const result = {
    query,
    players,
    assignments: includeAssignments ? assignments : [],
    assignmentCount: includeAssignments ? assignments.reduce((sum, entry) => sum + entry.items.length, 0) : 0,
  };

  if (includeAssignments) {
    result.issues = issues;
    result.total = totalIssues;
  }

  return result;
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

async function fetchTrello(config, payload = {}) {
  assertConfig('trello', config);
  const fields = ensureFields(config);
  const boardId = extractTrelloBoardId(config.resource || '');
  const apiKey = (fields.apiKey || '').trim();
  const includeAssignments = payload.includeAssignments === true;

  if (!boardId) {
    throw new IntegrationError('Trello board URL or ID is required.', 422);
  }
  if (!apiKey) {
    throw new IntegrationError('Trello API key is required.', 422);
  }

  let members = [];
  try {
    const membersUrl = new URL(`https://api.trello.com/1/boards/${boardId}/members`);
    membersUrl.searchParams.set('key', apiKey);
    membersUrl.searchParams.set('token', config.token.trim());
    membersUrl.searchParams.set('fields', 'fullName,username');
    const membersResponse = await fetchWithTimeout(membersUrl.toString(), { method: 'GET' });
    if (membersResponse.ok) {
      const data = await membersResponse.json();
      if (Array.isArray(data)) {
        members = data.map((member) => ({
          id: member.id,
          name: member.fullName || member.username || '',
        }));
      }
    }
  } catch (error) {
    console.warn('Trello member fetch failed', error);
  }

  const memberLookup = new Map();
  members.forEach((member) => {
    if (!member.name) return;
    memberLookup.set(member.id, member.name);
  });

  const assignmentsMap = new Map();
  let cards = [];

  if (includeAssignments) {
    const url = new URL(`https://api.trello.com/1/boards/${boardId}/cards`);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('token', config.token.trim());
    url.searchParams.set('fields', 'id,name,url,idList,pos,idMembers');
    url.searchParams.set('limit', '50');

    const response = await fetchWithTimeout(url.toString(), { method: 'GET' });
    if (!response.ok) {
      const text = await response.text();
      throw new IntegrationError(`Trello request failed: ${response.status} ${text}`.trim(), response.status);
    }

    const payloadCards = await response.json();
    cards = Array.isArray(payloadCards)
      ? payloadCards.map((card) => ({
          id: card.id,
          name: card.name,
          url: card.url,
          listId: card.idList,
          position: card.pos,
          memberIds: Array.isArray(card.idMembers) ? card.idMembers : [],
        }))
      : [];

    cards.forEach((card) => {
      card.memberIds.forEach((memberId) => {
        const name = memberLookup.get(memberId);
        if (!name) return;
        const list = assignmentsMap.get(name) || [];
        list.push({
          id: card.id,
          name: card.name,
          url: card.url,
          listId: card.listId,
        });
        assignmentsMap.set(name, list);
      });
    });
  }

  const players = uniqueStrings([
    ...members.map((member) => member.name),
    ...assignmentsMap.keys(),
  ]);

  const assignments = Array.from(assignmentsMap.entries()).map(([player, items]) => ({
    player,
    items,
  }));

  const result = {
    boardId,
    players,
    assignments: includeAssignments ? assignments : [],
    assignmentCount: includeAssignments ? assignments.reduce((sum, entry) => sum + entry.items.length, 0) : 0,
  };

  if (includeAssignments) {
    result.cards = cards;
    result.count = cards.length;
  }

  return result;
}

async function fetchGitHub(config, payload = {}) {
  assertConfig('github', config);
  const repo = (config.resource || '').trim();
  if (!repo || !repo.includes('/')) {
    throw new IntegrationError('GitHub repository must be in the form owner/repo.', 422);
  }

  const perPage = payload.perPage ? Math.min(Math.max(parseInt(payload.perPage, 10), 1), 100) : 20;
  const includeAssignments = payload.includeAssignments === true;
  let normalized = [];

  let collaborators = [];
  try {
    const collabUrl = new URL(`https://api.github.com/repos/${repo}/collaborators`);
    const collabResponse = await fetchWithTimeout(collabUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token.trim()}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'DailyPick-Worker',
      },
    });
    if (collabResponse.ok) {
      const data = await collabResponse.json();
      if (Array.isArray(data)) {
        collaborators = data
          .map((collaborator) => collaborator.name || collaborator.login || '')
          .filter(Boolean);
      }
    }
  } catch (error) {
    console.warn('GitHub collaborator fetch failed', error);
  }

  const assignmentsMap = new Map();
  let issues = [];

  if (includeAssignments) {
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

    issues = await response.json();
    normalized = Array.isArray(issues)
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

    normalized.forEach((issue) => {
      if (!issue.assignee) return;
      const list = assignmentsMap.get(issue.assignee) || [];
      list.push({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        url: issue.url,
        state: issue.state,
      });
      assignmentsMap.set(issue.assignee, list);
    });
  }

  const players = uniqueStrings([
    ...collaborators,
    ...Array.from(assignmentsMap.keys()),
  ]);

  const assignments = Array.from(assignmentsMap.entries()).map(([player, items]) => ({
    player,
    items,
  }));

  const result = {
    repository: repo,
    players,
    assignments: includeAssignments ? assignments : [],
    assignmentCount: includeAssignments ? assignments.reduce((sum, entry) => sum + entry.items.length, 0) : 0,
  };

  if (includeAssignments) {
    result.issues = normalized;
    result.count = normalized.length;
  }

  return result;
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
