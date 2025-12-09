import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getCollection } from 'astro:content';

let pagesWithOgImage: Set<string> | null = null;

/*
 * Note: the collections here should match what's in `src/pages/og/[...route].ts`
 */
async function getPagesWithOgImage(): Promise<Set<string>> {
  if (pagesWithOgImage) return pagesWithOgImage;

  const pages = new Set<string>();

  const docs = await getCollection('docs');
  docs.forEach((doc) => pages.add(doc.id));

  const pluginDocs = await getCollection('plugin-docs');
  pluginDocs.forEach((doc) => doc.data?.slug && pages.add(doc.data.slug));

  pagesWithOgImage = pages;
  return pages;
}

export const onRequest = defineRouteMiddleware(async (context) => {
  const routeId = context.locals.starlightRoute.id || 'index';
  const pages = await getPagesWithOgImage();

  let ogImageUrl: URL;

  // Check if this route has a generated OG image
  if (pages.has(routeId)) {
    const imagePath = `${import.meta.env['BASE_URL']}/og/${routeId}.png`;
    ogImageUrl = new URL(imagePath, import.meta.env['SITE']);
  } else {
    const fallbackPath = `${import.meta.env['BASE_URL']}/nx-media.png`;
    ogImageUrl = new URL(fallbackPath, import.meta.env['SITE']);
  }

  const { head } = context.locals.starlightRoute;
  head.push(
    {
      tag: 'meta',
      attrs: { property: 'og:image', content: ogImageUrl.href },
    },
    {
      tag: 'meta',
      attrs: { property: 'og:image:width', content: '1200' },
    },
    {
      tag: 'meta',
      attrs: { property: 'og:image:height', content: '630' },
    }
  );
});
