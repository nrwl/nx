import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Parse Framer config at module load time
const framerUrl = process.env.NEXT_PUBLIC_FRAMER_URL;
const framerPaths = new Set(
  (process.env.NEXT_PUBLIC_FRAMER_REWRITES || '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => (p.startsWith('/') ? p : `/${p}`))
);

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Check if this path should be proxied to Framer
  if (framerUrl && framerPaths.has(pathname)) {
    const framerDestination = new URL(pathname, framerUrl);
    // Copy query params
    request.nextUrl.searchParams.forEach((value, key) => {
      framerDestination.searchParams.set(key, value);
    });

    return NextResponse.rewrite(framerDestination, {
      headers: {
        'Cache-Control': 'public, max-age=3600, must-revalidate',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  // Only run middleware on paths that might be Framer pages
  // This avoids running on static assets, API routes, etc.
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, fonts, etc.)
     * - API routes
     */
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)).*)',
  ],
};
