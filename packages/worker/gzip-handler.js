import { getAssetFromKV } from '@cloudflare/kv-asset-handler';

/**
 * GZIP Handler for Cloudflare Workers
 * Serves pre-compressed .gz files when the client supports gzip encoding
 */

export async function handleGzipRequest(request, env, assetManifest) {
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  const supportsGzip = acceptEncoding.includes('gzip');

  if (!supportsGzip) {
    return null; // Let the default handler take over
  }

  const url = new URL(request.url);
  let path = url.pathname;

  // Map the path to assets similarly to the default handler
  if (path === '/') {
    path = '/index.html';
  } else if (path.endsWith('/')) {
    path = path.concat('index.html');
  } else if (!path.split('/').pop().includes('.')) {
    path = path.concat('/index.html');
  }

  // Check if a .gz version exists in the manifest
  const gzPath = `${path}.gz`;
  
  // Check if the gzipped version exists in the asset manifest
  if (assetManifest && assetManifest[gzPath]) {
    try {
      const gzRequest = new Request(new URL(gzPath, request.url), request);
      
      const response = await getAssetFromKV(
        { request: gzRequest },
        { ASSET_NAMESPACE: env.__STATIC_CONTENT, ASSET_MANIFEST: assetManifest }
      );

      // Create a new response with proper gzip headers
      if (response instanceof Response) {
        const headers = new Headers(response.headers);
        headers.set('Content-Encoding', 'gzip');
        // Remove content-length if present since it refers to uncompressed size
        headers.delete('Content-Length');
        // Add cache headers for better performance
        headers.set('Cache-Control', 'public, max-age=86400, immutable');
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers,
        });
      }
    } catch (e) {
      // If .gz serving fails, fall back to uncompressed
      return null;
    }
  }

  return null; // No .gz version available, use default handler
}

export function shouldCompressResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  return (
    contentType.includes('text/html') ||
    contentType.includes('text/css') ||
    contentType.includes('application/javascript') ||
    contentType.includes('text/javascript')
  );
}
