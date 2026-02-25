/**
 * Prebuild script that fetches banner configuration from a Framer URL
 * and saves it to a local JSON file for use at build time.
 *
 * The Framer page renders JSON inside a <pre> tag which we extract and parse.
 */

import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// Support configurable env var and output path for use by both nx-dev and astro-docs
const BANNER_ENV_VAR = process.env.BANNER_ENV_VAR || 'NEXT_PUBLIC_BANNER_URL';
const BANNER_URL = process.env[BANNER_ENV_VAR];
const OUTPUT_PATH = process.env.BANNER_OUTPUT_PATH || 'lib/banner.json';

/**
 * Extract JSON from a Framer HTML page.
 * Framer renders the banner config as JSON inside a <pre> tag.
 */
function extractJsonFromFramerHtml(html) {
  // Look for JSON in a <pre> tag (Framer renders it this way)
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch && preMatch[1]) {
    try {
      // Clean up any HTML entities and parse
      const jsonStr = preMatch[1]
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      console.warn('Failed to parse <pre> content as JSON:', e.message);
    }
  }

  // Fallback: try to parse the entire response as JSON (for direct JSON endpoints)
  try {
    return JSON.parse(html);
  } catch {
    // Not valid JSON
  }

  return null;
}

/**
 * Validate that the config has all required fields
 */
function validateBannerConfig(config) {
  if (!config || typeof config !== 'object') return false;
  if (typeof config.title !== 'string' || !config.title) return false;
  if (typeof config.description !== 'string') return false;
  if (typeof config.primaryCtaUrl !== 'string' || !config.primaryCtaUrl)
    return false;
  if (typeof config.primaryCtaText !== 'string' || !config.primaryCtaText)
    return false;
  // activeUntil is required for determining when the banner expires
  if (typeof config.activeUntil !== 'string' || !config.activeUntil)
    return false;
  return true;
}

async function main() {
  // Empty array for when no banner is configured
  const emptyCollection = [];

  if (!BANNER_URL) {
    console.log(`${BANNER_ENV_VAR} not set, writing empty banner collection`);
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(emptyCollection, null, 2) + '\n');
    return;
  }

  console.log(`Fetching banner config from: ${BANNER_URL}`);

  try {
    const response = await fetch(BANNER_URL, {
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    const config = extractJsonFromFramerHtml(text);

    if (!config) {
      throw new Error('No valid JSON found in banner page');
    }

    if (!validateBannerConfig(config)) {
      throw new Error('Invalid banner configuration format');
    }

    // Wrap in array for collection format, add id for Astro file loader
    const collection = [{ id: 'banner', ...config }];

    console.log('Banner config fetched successfully:', config.title);
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(collection, null, 2) + '\n');
    console.log(`Written to ${OUTPUT_PATH}`);
  } catch (error) {
    console.error('Failed to fetch banner config:', error.message);
    console.log('Writing empty banner collection as fallback');
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, JSON.stringify(emptyCollection, null, 2) + '\n');
  }
}

main();
