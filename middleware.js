// Password-protects the entire site (pages + API routes) using HTTP Basic
// Auth — the browser shows its own built-in login popup, no custom login
// page needed.
//
// Requires two environment variables set in Vercel (Settings → Environment
// Variables): SITE_USER and SITE_PASSWORD. If either is missing, the site
// loads normally with no login prompt at all — a login is only enforced
// once BOTH are set.
import { next } from '@vercel/edge';

export const config = {
  matcher: '/:path*',
};

export default function middleware(request) {
  const expectedUser = process.env.SITE_USER;
  const expectedPass = process.env.SITE_PASSWORD;

  if (!expectedUser || !expectedPass) {
    return next();
  }

  const auth = request.headers.get('authorization');

  if (auth && auth.startsWith('Basic ')) {
    const decoded = atob(auth.slice(6));
    const separatorIndex = decoded.indexOf(':');
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);

    if (user === expectedUser && pass === expectedPass) {
      return next();
    }
  }

  return new Response('Authentication required.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="2026 T&E Forecast"' },
  });
}
