#!/usr/bin/env node
const { execSync } = require('child_process');
const https = require('https');

// first two argument params are node and script
const INPUTS_MAIN_BRANCH_NAME = process.argv[2];
const PROJECT_SLUG = process.argv[3];
const URL = `https://circleci.com/api/v2/project/${PROJECT_SLUG}/pipeline?branch=${INPUTS_MAIN_BRANCH_NAME}`;

/**
 * Main
 * Cycle through pipelines until first successful run is found
 * or we reach the end of the pipeline history
 *
 * If found, log it to the parent process
 */
(async () => {
  let nextPage;
  let foundSHA;

  do {
    const { next_page_token, sha } = await findSha(nextPage);
    foundSHA = sha;
    nextPage = next_page_token;
  } while (!foundSHA && nextPage);

  if (foundSHA) {
    // send it to parent process
    process.stdout.write(foundSHA);
  }
})();

/**
 * Finds the last successful commit and/or token for the next page
 * @param {string} pageToken
 * @returns { next_page_token?: string, sha?: string }
 */
async function findSha(pageToken) {
  return getJson(pageToken ? `${URL}&page-token=${pageToken}` : URL).then(
    async ({ next_page_token, items }) => {
      const pipeline = await findSuccessfulPipeline(items);
      return {
        next_page_token,
        sha: pipeline ? pipeline.vcs.revision : void 0,
      };
    }
  );
}

/**
 * Get successful pipeline run if any
 * @param {Object[]} pipelines
 * @returns
 */
async function findSuccessfulPipeline(pipelines) {
  for (const pipeline of pipelines) {
    if (
      !pipeline.errors.length &&
      commitExists(pipeline.vcs.revision) &&
      (await isWorkflowSuccessful(pipeline.id))
    ) {
      return pipeline;
    }
  }
  return undefined;
}

/**
 * Check if given commit still exists
 * @param {string} commitSha
 * @returns
 */
function commitExists(commitSha) {
  try {
    execSync(`git cat-file -e ${commitSha} 2> /dev/null`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if every workflow in the pipeline is successful
 * @param {string} pipelineId
 * @returns {boolean}
 */
async function isWorkflowSuccessful(pipelineId) {
  return getJson(
    `https://circleci.com/api/v2/pipeline/${pipelineId}/workflow`
  ).then(({ items }) => items.every((item) => item.status === 'success'));
}

/**
 * Helper function to wrap Https.get as an async call
 * @param {string} url
 * @returns {Promise<JSON>}
 */
async function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = [];

        res.on('data', (chunk) => {
          data.push(chunk);
        });

        res.on('end', () => {
          const response = Buffer.concat(data).toString();
          resolve(JSON.parse(response));
        });
      })
      .on('error', (error) => reject(error));
  });
}
