// @ts-check

/**
 * This function is invoked by the publish.yml GitHub Action workflow and contains all of the dynamic logic needed
 * for the various workflow trigger types. This avoids the need for the logic to be stored in fragile inline
 * shell commands.
 *
 * @typedef {'--dry-run' | ''} DryRunFlag
 *
 * @typedef {{
 *   version: string;
 *   dry_run_flag: DryRunFlag;
 *   publish_branch: string;
 * }} PublishResolveData
 *
 * Partial from https://github.com/actions/toolkit/blob/c6b487124a61d7dc6c7bd6ea0208368af3513a6e/packages/github/src/context.ts
 * @typedef {{
 *   actor: string;
 *   runId: number;
 *   repo: { owner: string; repo: string };
 * }} GitHubContext
 *
 * @param {{
 *  github: import('octokit/dist-types').Octokit;
 *  context: GitHubContext;
 *  core: import('@actions/core');
 * }} param
 */
module.exports = async ({ github, context, core }) => {
  const data = await getPublishResolveData({ github, context });

  // Ensure that certain outputs are always set
  if (!data.version) {
    throw new Error('The "version" to release could not be determined');
  }
  if (!data.publish_branch) {
    throw new Error('The "publish_branch" could not be determined');
  }

  // Set the outputs to be consumed in later steps
  core.setOutput('version', data.version);
  core.setOutput('dry_run_flag', data.dry_run_flag);
  core.setOutput('publish_branch', data.publish_branch);
};

/**
 * @param {{
 *  github: import('octokit/dist-types').Octokit;
 *  context: GitHubContext;
 * }} param
 *
 * @returns {Promise<PublishResolveData>}
 */
async function getPublishResolveData({ github, context }) {
  // We use empty strings as default values so that we can let the `actions/checkout` action apply its default resolution
  /**
   * "The short ref name of the branch or tag that triggered the workflow run. This value matches the branch or tag name shown
   * on GitHub. For example, feature-branch-1."
   *
   * Source: https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables
   */
  const refName = process.env.GITHUB_REF_NAME;
  if (!refName) {
    throw new Error('The github ref name could not be determined');
  }

  const DEFAULT_PUBLISH_BRANCH = `publish/${refName}`;

  /** @type {DryRunFlag} */
  const DRY_RUN_DISABLED = '';
  /** @type {DryRunFlag} */
  const DRY_RUN_ENABLED = '--dry-run';

  switch (process.env.GITHUB_EVENT_NAME) {
    case 'schedule': {
      const data = {
        version: 'canary',
        dry_run_flag: DRY_RUN_DISABLED,
        publish_branch: DEFAULT_PUBLISH_BRANCH,
      };
      console.log('"schedule" trigger detected', { data });
      return data;
    }

    case 'release': {
      const data = {
        version: refName,
        dry_run_flag: DRY_RUN_DISABLED,
        publish_branch: DEFAULT_PUBLISH_BRANCH,
      };
      console.log('"release" trigger detected', { data });
      return data;
    }

    default:
      throw new Error(
        `The publish.yml workflow was triggered by an unexpected event: "${process.env.GITHUB_EVENT_NAME}"`
      );
  }
}

function getSuccessCommentForPR({
  context,
  version,
  repo,
  ref,
  pr_short_sha,
  pr_full_sha,
}) {
  return `## 🐳 We have a release for that!

  This PR has a release associated with it. You can try it out using this command:
  
  \`\`\`bash
  npx create-nx-workspace@${version} my-workspace
  \`\`\`

  Or just copy this version and use it in your own command:
  \`\`\`bash
  ${version}
  \`\`\`

  | Release details | 📑 |
  | ------------- | ------------- |
  | **Published version** | [${version}](https://www.npmjs.com/package/nx/v/${version}) |
  | **Triggered by** | @${context.actor} |
  | **Branch** | [${ref}](https://github.com/${repo}/tree/${ref}) |
  | **Commit** | [${pr_short_sha}](https://github.com/${repo}/commit/${pr_full_sha}) |
  | **Workflow run** | [${context.runId}](https://github.com/nrwl/nx/actions/runs/${context.runId}) |

  To request a new release for this pull request, mention someone from the Nx team or the \`@nrwl/nx-pipelines-reviewers\`.
`;
}
