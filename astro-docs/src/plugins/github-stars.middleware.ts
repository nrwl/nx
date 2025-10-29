import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { getGithubStars } from './utils/plugin-stats';

let cachedStarCount: number | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

// Default star count for development/demo when GitHub API is unavailable
export const DEFAULT_STAR_COUNT = 23000;

async function getNxRepoStarCount(): Promise<number> {
  const now = Date.now();

  // Return cached value if still valid
  if (cachedStarCount !== null && now - lastFetchTime < CACHE_DURATION) {
    return cachedStarCount;
  }

  try {
    const ghStarMap = await getGithubStars([{ owner: 'nrwl', repo: 'nx' }]);
    const starCount = ghStarMap.get('nrwl/nx')?.stargazers?.totalCount || 0;

    cachedStarCount = starCount;
    lastFetchTime = now;

    return starCount;
  } catch (error) {
    console.error('Failed to fetch GitHub stars for nrwl/nx:', error);
    // Return cached value if available, otherwise 0
    return cachedStarCount || 0;
  }
}

export const onRequest = defineRouteMiddleware(async (context) => {
  // Add GitHub star count to the context
  const starCount = await getNxRepoStarCount();

  // Extend the context with our custom data
  context.locals.githubStarsCount = starCount;
});
