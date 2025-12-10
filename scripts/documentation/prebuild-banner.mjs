/**
 * Prebuild script to fetch banner configuration for nx-dev.
 *
 * If NEXT_PUBLIC_BANNER_URL is set, fetches the JSON and overwrites banner-config.json.
 * Otherwise, uses the committed banner-config.json as-is.
 *
 * Run from workspace root: node scripts/documentation/prebuild-banner.mjs
 */

import { writeFileSync } from 'fs';
import { join } from 'path';

const outputPath = join(process.cwd(), 'nx-dev/nx-dev/lib/banner-config.json');

async function main() {
  const bannerUrl = process.env.NEXT_PUBLIC_BANNER_URL;

  if (!bannerUrl) {
    console.log(
      'NEXT_PUBLIC_BANNER_URL not set, using committed banner-config.json'
    );
    return;
  }

  console.log(`Fetching banner from: ${bannerUrl}`);
  try {
    const response = await fetch(bannerUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    writeFileSync(outputPath, JSON.stringify(data, null, 2) + '\n');
    console.log(`Banner fetched and saved to: ${outputPath}`);
  } catch (error) {
    console.warn(`Failed to fetch banner: ${error.message}`);
    console.log('Using committed banner-config.json as fallback');
  }
}

main().catch((error) => {
  console.error('Prebuild banner script failed:', error);
  process.exit(1);
});
