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

export const { getStaticPaths, GET } = await OGImageRoute({
  pages,
  getImageOptions: (path, page) => {
    return {
      title: page.data.title,
      description: 'Nx Documentation',
      // Nx brand neutrals: 950 canvas, 900 frame, 400 for the muted line.
      bgGradient: [[12, 12, 13]],
      border: { color: [25, 25, 26], width: 20 },
      padding: 120,
      fonts: [
        './public/fonts/instrument-sans-400.woff2',
        './public/fonts/instrument-sans-600.woff2',
      ],
      font: {
        title: {
          color: [255, 255, 255],
          size: 60,
          families: ['Instrument Sans'],
          weight: 'SemiBold',
        },
        description: {
          color: [163, 163, 168],
          size: 36,
          families: ['Instrument Sans'],
        },
      },
      logo: {
        path: './src/assets/nx/nx-og-logo.png',
      },
    };
  },
});
