import { defineRouteMiddleware } from '@astrojs/starlight/route-data';

const CANONICAL_DOMAIN = 'https://nx.dev';

export const onRequest = defineRouteMiddleware((context) => {
  const { head } = context.locals.starlightRoute;
  const pathname = context.url.pathname;

  const canonicalUrl = new URL(pathname, CANONICAL_DOMAIN).href;

  const existingCanonicalIndex = head.findIndex(
    (entry) => entry.tag === 'link' && entry.attrs?.rel === 'canonical'
  );

  const canonicalEntry = {
    tag: 'link' as const,
    attrs: { rel: 'canonical', href: canonicalUrl },
  };

  if (existingCanonicalIndex !== -1) {
    head[existingCanonicalIndex] = canonicalEntry;
  } else {
    head.push(canonicalEntry);
  }
});
