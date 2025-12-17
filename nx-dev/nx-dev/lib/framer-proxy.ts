import type { GetServerSidePropsContext } from 'next';

// Parse once at module load time
const framerUrl = process.env.NEXT_PUBLIC_FRAMER_URL;
const framerPaths = (process.env.NEXT_PUBLIC_FRAMER_REWRITES || '')
  .split(',')
  .map((p) => p.trim())
  .filter((p) => p.length > 0)
  .map((p) => (p.startsWith('/') ? p : `/${p}`));

/**
 * Try to proxy the current page to Framer if configured.
 *
 * Add this to any page's getServerSideProps:
 * ```ts
 * export const getServerSideProps: GetServerSideProps = async (ctx) => {
 *   if (await tryFramerProxy(ctx)) return { props: {} };
 *   return { props: { ... } };
 * };
 * ```
 *
 * @returns true if proxied to Framer (response already sent), false otherwise
 */
export async function tryFramerProxy(
  ctx: GetServerSidePropsContext
): Promise<boolean> {
  const pathname = ctx.resolvedUrl.split('?')[0];

  if (!framerUrl || !framerPaths.includes(pathname)) {
    return false;
  }

  try {
    const response = await fetch(`${framerUrl}${pathname}`, {
      headers: {
        'User-Agent': ctx.req.headers['user-agent'] || '',
        Accept: 'text/html',
      },
    });

    if (response.ok) {
      const html = await response.text();
      // Revalidate every hour so env var changes take effect
      ctx.res.setHeader(
        'Cache-Control',
        'public, max-age=3600, must-revalidate'
      );
      ctx.res.setHeader('Content-Type', 'text/html; charset=utf-8');
      ctx.res.write(html);
      ctx.res.end();
      return true;
    }
  } catch (error) {
    console.error('Error fetching Framer page:', error);
  }

  return false;
}
