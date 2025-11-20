import { getCollection } from 'astro:content';
import { OGImageRoute } from 'astro-og-canvas';

/*
 * Note: the collections here should match what's in `src/plugins/og.middleware.ts`
 */

const entries = await getCollection('docs');

const pages: Record<string, { data: { title: string } }> = Object.fromEntries(
  entries.map(({ data, id }) => [id, { data }])
);

// Add generated API docs
for (const doc of await getCollection('plugin-docs')) {
  pages[doc.data.slug] = doc;
}

export const { getStaticPaths, GET } = OGImageRoute({
  param: 'route',
  pages,
  getImageOptions: (path, page) => {
    return {
      title: page.data.title,
      description: 'Nx Documentation',
      bgGradient: [[2, 6, 24]],
      border: { color: [15, 23, 43], width: 20 },
      padding: 120,
      font: {
        title: {
          color: [255, 255, 255],
          size: 60,
        },
        description: {
          color: [144, 161, 185],
          size: 36,
        },
      },
      logo: {
        path: './src/assets/nx/nx-og-logo.png',
      },
    };
  },
});
