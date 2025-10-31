import { Router } from 'itty-router';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { CollaborationSession } from '../shared/collaboration.js';
import { IntegrationConfig } from '../shared/integration-config.js';
import { fetchIntegrationData, IntegrationError } from '../shared/integration-clients.js';
import { BallGameSession } from '../../apps/ballgame/ball-game-session.js';
import { MimicGameSession } from '../../apps/mimic-master/mimic-game-session.js';
import { PlanningPokerSession } from '../../apps/planning-poker/planning-poker-session.js';
import manifest from '__STATIC_CONTENT_MANIFEST';

const assetManifest = JSON.parse(manifest);

const router = Router();

console.log('[Worker Debug] Initializing router');

// Define specific routes for WebSocket upgrades
router.get('/api/collaboration/websocket', (request, env) => {
    console.log("[Worker Debug] Request /api/collaboration WebSocket received.");
    const url = new URL(request.url);
    const id = url.searchParams.get('session_id'); // Get ID from query param
    console.log("[Worker Debug] Collaboration WS: Extracted session_id from query:", id);

    if (!id) {
      console.error("[Worker Debug] Collaboration WS: Missing session_id query parameter.");
      return new Response('Missing session_id query parameter', { status: 400 });
    }

    const durableObjectId = env.COLLABORATION_SESSION.idFromName(id);
    console.log("[Worker Debug] Collaboration WS: Mapping session_id to Durable Object ID:", durableObjectId.toString());

    const durableObject = env.COLLABORATION_SESSION.get(durableObjectId);
    return durableObject.fetch(request);
});

router.get('/api/ballgame/websocket', (request, env) => {
    console.log("[Worker Debug] Request /api/ballgame WebSocket received.");
    console.log("[Worker Debug] Request URL:", request.url);
    const url = new URL(request.url);
    const id = url.searchParams.get('session_id'); // Get ID from query param
    console.log("[Worker Debug] BallGame WS: Extracted session_id from query:", id);

    if (!id) {
      console.error("[Worker Debug] BallGame WS: Missing session_id query parameter.");
      return new Response('Missing session_id query parameter', { status: 400 });
    }

    // THIS IS THE CRITICAL LINE FOR UNIQUE SESSIONS: idFromName(id)
    const durableObjectId = env.BALL_GAME_SESSION.idFromName(id);
    console.log("[Worker Debug] BallGame WS: Mapping session_id to Durable Object ID:", durableObjectId.toString());

    const durableObject = env.BALL_GAME_SESSION.get(durableObjectId);
    return durableObject.fetch(request);
});

router.get('/api/mimic-master/websocket', (request, env) => {
    console.log('[Worker Debug] Request /api/mimic-master WebSocket received.');
    const url = new URL(request.url);
    const id = url.searchParams.get('session_id');

    if (!id) {
        console.error('[Worker Debug] Mimic Master WS: Missing session_id query parameter.');
        return new Response('Missing session_id query parameter', { status: 400 });
    }

    const durableObjectId = env.MIMIC_GAME_SESSION.idFromName(id);
    const durableObject = env.MIMIC_GAME_SESSION.get(durableObjectId);
    return durableObject.fetch(request);
});

router.get('/api/planning-poker/websocket', (request, env) => {
    console.log('[Worker Debug] Request /api/planning-poker WebSocket received.');
    const url = new URL(request.url);
    const id = url.searchParams.get('session_id');

    if (!id) {
        console.error('[Worker Debug] Planning Poker WS: Missing session_id query parameter.');
        return new Response('Missing session_id query parameter', { status: 400 });
    }

    const durableObjectId = env.PLANNING_POKER_SESSION.idFromName(id);
    const durableObject = env.PLANNING_POKER_SESSION.get(durableObjectId);
    return durableObject.fetch(request);
});

const INTERNAL_CONFIG_ORIGIN = 'https://integrations.internal';

const forwardIntegrationRequest = (request, env) => {
  const id = env.INTEGRATION_CONFIG.idFromName('global');
  const stub = env.INTEGRATION_CONFIG.get(id);
  return stub.fetch(request);
};

const loadIntegrationConfig = async (env, service) => {
  const id = env.INTEGRATION_CONFIG.idFromName('global');
  const stub = env.INTEGRATION_CONFIG.get(id);
  const internalUrl = new URL(`/config/${service}`, INTERNAL_CONFIG_ORIGIN);
  internalUrl.searchParams.set('includeSecrets', '1');
  const response = await stub.fetch(internalUrl.toString(), { method: 'GET' });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to read integration config: ${response.status} ${errorText}`);
  }
  const body = await response.json();
  return body?.config || null;
};

router.get('/api/integrations/config', forwardIntegrationRequest);
router.put('/api/integrations/config/:service', forwardIntegrationRequest);
router.delete('/api/integrations/config/:service', forwardIntegrationRequest);
router.options('/api/integrations/config', forwardIntegrationRequest);
router.options('/api/integrations/config/:service', forwardIntegrationRequest);

router.post('/api/integrations/:service/pull', async (request, env) => {
  const { service } = request.params;
  if (!service) {
    return new Response(JSON.stringify({ error: 'Service name is required.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let payload = {};
  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  try {
    const config = await loadIntegrationConfig(env, service);
    const data = await fetchIntegrationData(service, config, payload);
    return new Response(JSON.stringify({ service, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof IntegrationError) {
      return new Response(JSON.stringify({ error: error.message, status: error.status }), {
        status: error.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    console.error(`Integration pull failed for ${service}`, error);
    return new Response(JSON.stringify({ error: 'Failed to contact integration service.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// A catch-all for any other API requests that don't match
router.all('/api/*', (request) => {
  console.warn(`[Worker Debug] API route not found for: ${request.url}`);
  return new Response('API route not found.', { status: 404 });
});

const serveBallGame = async (request, env, ctx) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    console.log("[Worker Debug] Request for Ball Game HTML (session_id via query param):", sessionId || 'none');

    // Serve the main index.html for the /ballgame path, regardless of query params
    try {
        const options = {
            mapRequestToAsset: req => new Request(new URL('/apps/ballgame/index.html', req.url), req)
        };
        const assetResponse = await getAssetFromKV(
            { request, waitUntil: ctx.waitUntil.bind(ctx) },
            { ...options, ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest }
        );
        console.log(`[Worker Debug] Successfully served /index.html for /ballgame route with status: ${assetResponse.status}`);
        return assetResponse;
    } catch (e) {
        console.error(`[Worker Debug] Error serving /ballgame HTML (index.html issue):`, e.message, e.stack);
        return new Response('Game Page Not Found (index.html serving error)', { status: 500 });
    }
};

router.get('/apps/ballgame', serveBallGame);
router.get('/ballgame', (request) => {
    const target = new URL('/apps/ballgame/', request.url);
    return Response.redirect(target.toString(), 301);
});


export default {
    async fetch(request, env, ctx) {
        console.log(`[Worker Debug] Incoming request URL: ${request.url}`);

        const response = await router.handle(request, env, ctx);
        if (response && response.status !== 404) { // Added null/undefined check for response
            console.log(`[Worker Debug] Router handled request with status: ${response.status}`);
            return response;
        }

        // If the router didn't handle it, proceed with static asset serving.
        try {
            const options = {
                mapRequestToAsset: req => {
                    const url = new URL(req.url);
                    let path = url.pathname;

                    // Standard asset path mapping
                    if (path === '/') {
                        path = '/index.html';
                    } else if (path.endsWith('/')) {
                        path = path.concat('index.html');
                    } else if (!path.split('/').pop().includes('.')) {
                        // If path doesn't end with a file extension, assume it's a directory and append index.html
                        path = path.concat('/index.html');
                    }
                    console.log(`[Worker Debug] Static asset handler mapping ${req.url} to ${path}`);
                    return new Request(new URL(path, req.url), req);
                }
            };

            const assetResponse = await getAssetFromKV(
                { request, waitUntil: ctx.waitUntil.bind(ctx) },
                { ...options, ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest }
            );

            // Ensure assetResponse is a valid Response object
            if (assetResponse instanceof Response) {
                console.log(`[Worker Debug] Served static asset: ${request.url} with status ${assetResponse.status}`);
                return assetResponse;
            } else {
                // This case should theoretically not happen if getAssetFromKV is working correctly
                console.error(`[Worker Debug] getAssetFromKV for ${request.url} did not return a Response object.`);
                return new Response('Internal Server Error: Asset handler failed', { status: 500 });
            }

        } catch (e) {
            console.error(`[Worker Debug] Error serving static asset for ${request.url}:`, e.message, e.stack);
            // Attempt to serve 404.html as a fallback
            try {
                const notFoundResponse = await getAssetFromKV(
                    { request: new Request(new URL('/404.html', request.url), request), waitUntil: ctx.waitUntil.bind(ctx) },
                    { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest }
                );

                // Ensure notFoundResponse is a valid Response object
                if (notFoundResponse instanceof Response) {
                    console.log(`[Worker Debug] Served 404.html for ${request.url} with status ${notFoundResponse.status}`);
                    // Return with status 404 even if the 404.html itself came with 200
                    return new Response(notFoundResponse.body, { ...notFoundResponse, status: 404 });
                } else {
                    console.error(`[Worker Debug] getAssetFromKV for 404.html did not return a Response object.`);
                    return new Response('Not Found: Error serving custom 404', { status: 404 });
                }
            } catch (innerError) {
                console.error(`[Worker Debug] Failed to serve generic 404 for ${request.url} due to inner error:`, innerError.message, innerError.stack);
                return new Response('Not Found', { status: 404 });
            }
        }
    },
};

export { CollaborationSession, BallGameSession, MimicGameSession, PlanningPokerSession, IntegrationConfig };
