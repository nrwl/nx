/**
 * Captures static PNGs of interactive {% graph %} components for articles
 * migrating to the Pylon KB. Requires a running preview of the built site
 * (`npx astro preview` in astro-docs, port 4321).
 *
 * Usage: tsx scripts/pylon/capture-graph-screenshots.ts
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(__dirname, 'assets');
// astro.config.mjs sets base: '/docs', so preview serves under /docs.
const BASE = 'http://localhost:4321/docs';

const PAGES: Array<{ route: string; slug: string; count: number }> = [
  {
    route: '/guides/tips-n-tricks/feature-based-testing',
    slug: 'feature-based-testing',
    count: 1,
  },
  {
    route: '/concepts/ci-concepts/reduce-waste',
    slug: 'reduce-waste',
    count: 7,
  },
  {
    route: '/guides/tasks--caching/configure-inputs',
    slug: 'configure-inputs',
    count: 1,
  },
  {
    route: '/guides/tasks--caching/workspace-watching',
    slug: 'workspace-watching',
    count: 1,
  },
  {
    route: '/features/maintain-typescript-monorepos',
    slug: 'maintain-typescript-monorepos',
    count: 2,
  },
  {
    route: '/technologies/angular/guides/nx-and-angular',
    slug: 'nx-and-angular',
    count: 1,
  },
];

async function main(): Promise<void> {
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    colorScheme: 'light',
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('starlight-theme', 'light');
  });

  for (const { route, slug, count } of PAGES) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    // The cookie banner floats over page content — hide it for clean shots.
    await page.addStyleTag({
      content: '#cookiebanner { display: none !important; }',
    });
    const islands = page.locator('astro-island[component-export="Graph"]');
    const found = await islands.count();
    if (found !== count) {
      console.warn(
        `${route}: expected ${count} graph islands, found ${found} — capturing what exists`
      );
    }
    for (let i = 0; i < found; i++) {
      const island = islands.nth(i);
      await island.scrollIntoViewIfNeeded();
      // client:visible hydration + graph layout
      await island
        .locator('canvas, svg, .nx-graph, [data-cy]')
        .first()
        .waitFor({ state: 'visible', timeout: 15000 })
        .catch(() => undefined);
      await page.waitForTimeout(2500);
      const file = path.join(ASSETS, `${slug}-graph-${i + 1}.png`);
      // astro-island is display:contents — screenshot the rendered child.
      await island.locator(':scope > *').first().screenshot({ path: file });
      console.log(`captured ${file}`);
    }
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
