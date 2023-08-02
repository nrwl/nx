import { Octokit } from 'octokit';

let cachedGithubStarCountPromise: null | Promise<number> = null;

export async function fetchGithubStarCount() {
  if (cachedGithubStarCountPromise !== null) {
    // If the promise is in the cache, return it directly
    return cachedGithubStarCountPromise;
  }

  cachedGithubStarCountPromise = (async () => {
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
    } catch (e) {
      return 0; // fallback, will hide GitHub star widget
    }
  })();

  return cachedGithubStarCountPromise;
}
