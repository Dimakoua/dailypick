const FLOW_DETAILS = {
  standup: {
    label: 'Stand-up energizer flow',
    description: 'Wheel, Speedway, and Trap! keep stand-ups fair, quick, and playful.',
    playUrl: 'https://dailypick.dev/apps/wheel/',
  },
  planning: {
    label: 'Sprint Planning Pack',
    description: 'Morale Thermometer, Planning Poker Hub, and Capacity Dice together for richer planning check-ins.',
    playUrl: 'https://dailypick.dev/apps/planning-poker/',
  },
  retro: {
    label: 'Retro icebreaker flow',
    description: 'Kick off your retro with Mimic Master or Gravity Drift before the discussion starts.',
    playUrl: 'https://dailypick.dev/apps/mimic-master/',
  },
  morale: {
    label: 'Morale Thermometer ritual',
    description: 'Collect anonymous gratitude and energy signals that inform better sprint planning.',
    playUrl: 'https://dailypick.dev/apps/morale-thermometer/',
  },
};

const FLOW_ALIASES = {
  standup: 'standup',
  energizer: 'standup',
  random: 'standup',
  planning: 'planning',
  poker: 'planning',
  estimate: 'planning',
  sprint: 'planning',
  retro: 'retro',
  icebreaker: 'retro',
  morale: 'morale',
  pulse: 'morale',
  energy: 'morale',
};

function deriveFlow(text) {
  if (!text) {
    return 'standup';
  }
  const normalized = text.trim().toLowerCase();
  for (const [keyword, flowKey] of Object.entries(FLOW_ALIASES)) {
    if (normalized.includes(keyword)) {
      return flowKey;
    }
  }
  return 'standup';
}

function constantTimeCompare(a, b) {
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

async function verifySlackSignature(rawBody, signature, timestamp, signingSecret) {
  if (!signature || !timestamp || !signingSecret) {
    return false;
  }
  const now = Math.floor(Date.now() / 1000);
  const requestTs = Number(timestamp);
  if (Number.isNaN(requestTs)) {
    return false;
  }
  if (Math.abs(now - requestTs) > 60 * 5) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(baseString));
  const hash = Array.from(new Uint8Array(signatureBuffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
  const expected = `v0=${hash}`;
  return constantTimeCompare(signature, expected);
}

const INTERNAL_CONFIG_ORIGIN = 'https://integrations.internal';

async function loadSlackConfig(env, clientId) {
  if (!env?.INTEGRATION_CONFIG || !clientId) {
    return null;
  }
  try {
    const id = env.INTEGRATION_CONFIG.idFromName(clientId);
    const stub = env.INTEGRATION_CONFIG.get(id);
    const internalUrl = new URL('/config/slack', INTERNAL_CONFIG_ORIGIN);
    internalUrl.searchParams.set('includeSecrets', '1');
    const response = await stub.fetch(internalUrl.toString(), { method: 'GET' });
    if (!response.ok) {
      return null;
    }
    const body = await response.json();
    return body?.config || null;
  } catch {
    return null;
  }
}

async function resolveSlackSigningSecret(env, clientId) {
  const config = await loadSlackConfig(env, clientId);
  if (config?.token) {
    return config.token;
  }
  return env.SLACK_SIGNING_SECRET || null;
}

function getBaseUrl(env) {
  return (env.DAILYPICK_BASE_URL || 'https://dailypick.dev').replace(/\/$/, '');
}

function buildSlackPayload(flowKey, baseUrl, userId) {
  const flow = FLOW_DETAILS[flowKey] || FLOW_DETAILS.standup;
  const settingsUrl = `${baseUrl}/apps/settings/#slack`;
  const userMention = userId ? `<@${userId}>` : 'Team';

  return {
    response_type: 'ephemeral',
    text: `Daily Pick ${flow.label} ready.`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Thanks ${userMention}! Kick off the *${flow.label}* now.`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: flow.description,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open the ritual' },
            style: 'primary',
            url: flow.playUrl,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Slack setup guide' },
            url: settingsUrl,
          },
        ],
      },
    ],
  };
}

export async function handleSlackSlashCommand(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-slack-signature');
  const timestamp = request.headers.get('x-slack-request-timestamp');
  const url = new URL(request.url);
  const clientId = url.searchParams.get('client_id');
  const signingSecret = await resolveSlackSigningSecret(env, clientId);

  if (!signingSecret) {
    return new Response('Slack signing secret not configured', { status: 500 });
  }

  const isValid = await verifySlackSignature(rawBody, signature, timestamp, signingSecret);
  if (!isValid) {
    return new Response('Unauthorized', { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const flowKey = deriveFlow(params.get('text'));
  const payload = buildSlackPayload(flowKey, getBaseUrl(env), params.get('user_id'));

  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
