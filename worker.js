import { Router } from 'itty-router';
import { getAssetFromKV } from '@cloudflare/kv-asset-handler';
import { CollaborationSession } from './collaboration.js';
import { BallGameSession } from './ballgame/ball-game-session.js';

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

// A catch-all for any other API requests that don't match
router.all('/api/*', (request) => {
  console.warn(`[Worker Debug] API route not found for: ${request.url}`);
  return new Response('API route not found.', { status: 404 });
});

router.get('/ballgame', async (request, env, ctx) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    console.log("[Worker Debug] Request for Ball Game HTML (session_id via query param):", sessionId || 'none');

    // Serve the main index.html for the /ballgame path, regardless of query params
    try {
        const assetManifest = JSON.parse(env.__STATIC_CONTENT_MANIFEST);
        const options = {
            mapRequestToAsset: req => new Request(new URL('/ballgame/index.html', req.url), req)
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
            const assetManifest = JSON.parse(env.__STATIC_CONTENT_MANIFEST);
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
                const assetManifest = JSON.parse(env.__STATIC_CONTENT_MANIFEST);
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

export { CollaborationSession, BallGameSession };