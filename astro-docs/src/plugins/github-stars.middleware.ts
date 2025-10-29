import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import { Octokit } from 'octokit';

let cachedStarCountPromise: Promise<number> | null = null;

async function getNxRepoStarCount(): Promise<number> {
  if (cachedStarCountPromise !== null) {
    // If the promise is in the cache, return it directly
    return cachedStarCountPromise;
  }

  cachedStarCountPromise = (async () => {
    try {
      const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
      const responseData = await octokit.request('GET /repos/{owner}/{repo}', {
        owner: 'nrwl',
        repo: 'nx',
        headers: {
          'X-GitHub-Api-Version': '2022-11-28',
        },
        retry: { enabled: false },
        throttle: {
          enabled: true,
        },
      });

      return responseData.data.stargazers_count;
    } catch (error) {
      console.error('Failed to fetch GitHub stars for nrwl/nx:', error);
      return 0;
    }
  })();

  return cachedStarCountPromise;
}

export const onRequest = defineRouteMiddleware(async (context) => {
  // Add GitHub star count to the context
  const starCount = await getNxRepoStarCount();

  // Extend the context with our custom data
  context.locals.githubStarsCount = starCount;
});
