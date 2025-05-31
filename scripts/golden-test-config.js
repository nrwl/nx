const fs = require('fs');
const axios = require('axios');

const goldenTestConfig = {
  angular: ['*'],
  cypress: ['*'],
  esbuild: ['*'],
  eslint: ['*'],
  gradle: ['*'],
  detox: ['*'],
  expo: ['*'],
  jest: ['*'],
  js: ['*'],
  'lerna-smoke-tests': ['*'],
  next: ['*'],
  node: ['*'],
  nuxt: ['*'],
  nx: ['*'],
  'nx-init': ['*'],
  playwright: ['*'],
  plugin: ['*'],
  react: ['*'],
  'react-native': ['*'],
  release: ['*'],
  rollup: ['*'],
  remix: ['*'],
  rspack: ['*'],
  storybook: ['*'],
  vite: ['*'],
  vue: ['*'],
  web: ['*'],
  webpack: ['*'],
  'workspace-create': ['*'],
};

const nrwlians = [
  'AgentEnder',
  'Cammisuli',
  'Coly010',
  'FrozenPandaz',
  'JamesHenry',
  'JoeRJohnson11',
  'MaxKless',
  'barbados-clemens',
  'bcabanes',
  'caitlinthefirst',
  'dillon-nx',
  'fahslaj',
  'hendecj',
  'isaacplmann',
  'jaysoo',
  'jeffbcross',
  'jordanpowell88',
  'joshvanallen',
  'juristr',
  'leosvelperez',
  'llwt',
  'lourw',
  'mandarini',
  'meeroslav',
  'mhartington',
  'mrl-jr',
  'nartc',
  'ndcunningham',
  'nixallover',
];

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

function parseTestResults() {
  const testResults = [];

  console.log('🔍 Looking for test results in project folders...');

  for (const projectName of Object.keys(goldenTestConfig)) {
    const testResultsPath = `e2e/${projectName}/test-results.json`;

    if (fs.existsSync(testResultsPath)) {
      try {
        const rawResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
        console.log(
          `✅ Found test results for ${projectName}: ${testResultsPath}`
        );

        const projectResults = parseProjectResults(rawResults, projectName);
        testResults.push(...projectResults);
      } catch (error) {
        console.warn(`⚠️  Failed to parse ${testResultsPath}:`, error.message);
      }
    } else {
      console.log(
        `ℹ️  No test results found for ${projectName} (${testResultsPath}) - skipping`
      );
    }
  }

  return testResults;
}

function parseProjectResults(nxResults, projectName) {
  const testResults = [];

  console.log(`📊 Processing results for project: ${projectName}`);

  // Handle Jest test result format
  if (nxResults.testResults && Array.isArray(nxResults.testResults)) {
    console.log(
      `📋 Found Jest format results with ${nxResults.testResults.length} test suites`
    );

    nxResults.testResults.forEach((testSuite) => {
      const parsed = parseJestTestSuite(testSuite, projectName, nxResults);
      if (parsed) testResults.push(parsed);
    });
  } else {
    console.warn(
      `⚠️  Unexpected test result format for ${projectName}, expected Jest format with testResults array`
    );
  }

  console.log(`📈 Found ${testResults.length} test results for ${projectName}`);
  return testResults;
}

function parseJestTestSuite(testSuite, projectName, overallResults) {
  // Extract test file name from the test suite
  const testFilePath =
    testSuite.testFilePath || testSuite.name || `${projectName} test suite`;
  const testFileName = testFilePath.split('/').pop() || testFilePath;

  const hasFailures =
    testSuite.numFailingTests > 0 ||
    (testSuite.failureMessage && testSuite.failureMessage.trim() !== '');

  const status = hasFailures ? 'failed' : 'passed';

  const failedTests = [];
  if (testSuite.testResults && Array.isArray(testSuite.testResults)) {
    testSuite.testResults.forEach((test) => {
      if (test.status === 'failed') {
        failedTests.push({
          title: test.title,
          fullName: test.fullName,
          duration: test.duration,
          failureMessages: test.failureMessages || [],
        });
      }
    });
  }

  return {
    project: projectName,
    testFile: testFileName,
    testFilePath: testFilePath,
    status: status,
    failures: testSuite.numFailingTests || 0,
    successes: testSuite.numPassingTests || 0,
    total: (testSuite.numPassingTests || 0) + (testSuite.numFailingTests || 0),
    duration: testSuite.perfStats
      ? testSuite.perfStats.end - testSuite.perfStats.start
      : 0,
    startTime: testSuite.perfStats?.start,
    endTime: testSuite.perfStats?.end,
    failureMessage: testSuite.failureMessage,
    failedTests: failedTests,
    source: `e2e/${projectName}/test-results.json`,
    // Include overall test run info
    overallSuccess: overallResults.success,
    totalFailedSuites: overallResults.numFailedTestSuites,
    totalFailedTests: overallResults.numFailedTests,
  };
}

function getPRLink() {
  const githubRepo = process.env.GITHUB_REPOSITORY;
  const githubServerUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';

  // Extract PR number from GITHUB_REF (refs/pull/123/merge)
  const prNumber =
    process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)\/merge/)?.[1] ||
    process.env.GITHUB_PR_NUMBER ||
    'unknown';

  if (githubRepo && prNumber !== 'unknown') {
    const prUrl = `${githubServerUrl}/${githubRepo}/pull/${prNumber}`;
    return `<${prUrl}|#${prNumber}>`;
  }

  return `#${prNumber}`;
}

function getPRAuthor() {
  return (
    process.env.GITHUB_ACTOR ||
    process.env.GITHUB_HEAD_REF_AUTHOR ||
    process.env.PR_AUTHOR
  );
}

// Check if a test is golden
function isGoldenTest(project, testFile) {
  const projectConfig = goldenTestConfig[project];
  if (!projectConfig) return false;

  // Handle wildcard '*' - all tests in project are golden
  if (projectConfig.includes('*')) return true;

  return projectConfig.some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      return regex.test(testFile);
    }
    return testFile.includes(pattern);
  });
}

function getSlackUserToNotify() {
  const prAuthor = getPRAuthor();

  if (prAuthor && nrwlians.includes(prAuthor)) {
    console.log(`📧 ${prAuthor} is a Nrwlian!`);
    return prAuthor;
  }

  console.log(
    `⚠️  No Slack mapping found for GitHub user: ${prAuthor || 'unknown'}`
  );
  return null;
}

function analyzeGoldenTestFailures(testResults) {
  const goldenFailures = [];
  const summary = {
    totalTests: testResults.length,
    totalFailures: 0,
    goldenFailures: 0,
    nonGoldenFailures: 0,
    projects: new Set(),
  };

  for (const result of testResults) {
    summary.projects.add(result.project);

    if (result.status === 'failed' || result.failures > 0) {
      summary.totalFailures++;

      if (isGoldenTest(result.project, result.testFile)) {
        summary.goldenFailures++;
        goldenFailures.push(result);
        console.log(
          `🚨 Golden test failure detected: ${result.project}/${result.testFile} (${result.failures} failed tests)`
        );
      } else {
        summary.nonGoldenFailures++;
      }
    }
  }

  return {
    goldenFailures,
    summary: {
      ...summary,
      projects: Array.from(summary.projects),
    },
  };
}

async function sendSlackAlert(goldenFailures, summary) {
  const prAuthor = getSlackUserToNotify();
  if (!prAuthor) {
    console.log(
      `⚠️ This PR is not authored by a Nrwlian, skipping notification`
    );
    return null;
  }
  if (!SLACK_WEBHOOK_URL) {
    console.log(
      '❌ No Slack webhook configured (SLACK_WEBHOOK_URL), skipping notification'
    );
    return false;
  }

  if (goldenFailures.length === 0) {
    console.log('✅ No golden test failures detected, no alert needed');
    return false;
  }

  // Group failures by project
  const failuresByProject = {};
  for (const failure of goldenFailures) {
    if (!failuresByProject[failure.project]) {
      failuresByProject[failure.project] = [];
    }
    failuresByProject[failure.project].push(failure);
  }

  // Build Slack message blocks
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚨 Golden E2E Test Failures`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Hey ${prAuthor}, *${goldenFailures.length}* golden test suite(s) are failing. Please address these test failures before merging.`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Total Test Suites:* ${summary.totalTests}`,
        },
        {
          type: 'mrkdwn',
          text: `*Golden Failures:* ${summary.goldenFailures}`,
        },
        {
          type: 'mrkdwn',
          text: `*Affected Projects:* ${Object.keys(failuresByProject).length}`,
        },
        {
          type: 'mrkdwn',
          text: `*Total Failed Tests:* ${goldenFailures.reduce(
            (sum, f) => sum + f.failures,
            0
          )}`,
        },
      ],
    },
  ];

  // Add details for each project with failures
  for (const [project, failures] of Object.entries(failuresByProject)) {
    for (const failure of failures.slice(0, 2)) {
      // Limit to 2 test suites per project
      const fileName = failure.testFile;
      const failureCount = failure.failures;

      let failureDetails = `*${project}/${fileName}* - ${failureCount} test(s) failed\n`;

      // Add specific failed test names if available
      if (failure.failedTests && failure.failedTests.length > 0) {
        const testList = failure.failedTests
          .slice(0, 3) // Show up to 3 failed tests
          .map((test) => `• ${test.title}`)
          .join('\n');

        failureDetails += `${testList}`;

        if (failure.failedTests.length > 3) {
          failureDetails += `\n_...and ${
            failure.failedTests.length - 3
          } more failed tests_`;
        }
      }

      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: failureDetails,
        },
      });
    }

    if (failures.length > 2) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `_...and ${
            failures.length - 2
          } more test suites in ${project}_`,
        },
      });
    }
  }

  // Add context information
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `PR: ${getPRLink()} | Commit: \`${(
          process.env.GITHUB_SHA || 'unknown'
        ).substring(0, 8)}\` | Run: <${
          process.env.GITHUB_SERVER_URL || 'https://github.com'
        }/${process.env.GITHUB_REPOSITORY}/actions/runs/${
          process.env.GITHUB_RUN_ID
        }|#${process.env.GITHUB_RUN_NUMBER || 'local'}>`,
      },
    ],
  });

  const message = {
    username: 'Golden Test Monitor',
    icon_emoji: ':rotating_light:',
    blocks: blocks,
  };

  try {
    await axios.post(SLACK_WEBHOOK_URL, message);
    console.log(`✅ Slack alert sent successfully`);
    return true;
  } catch (error) {
    console.error(
      '❌ Failed to send Slack alert:',
      error.response?.data || error.message
    );
    return false;
  }
}

// Main execution function
async function main() {
  console.log('🔍 Starting Golden Test Monitor...');
  console.log(`📋 Monitoring ${Object.keys(goldenTestConfig).length} projects`);

  // Parse test results
  const testResults = parseTestResults();
  if (testResults.length === 0) {
    console.log(
      'ℹ️  No test results found - this may be normal if no e2e tests ran'
    );
    console.log('✅ Exiting gracefully - no golden tests to check');
    process.exit(0);
  }

  console.log(`📊 Found ${testResults.length} test suite results\n`);

  // Analyze for golden test failures
  const { goldenFailures, summary } = analyzeGoldenTestFailures(testResults);

  // Display summary
  console.log('📈 Analysis Summary:');
  console.log(`   Total Test Suites: ${summary.totalTests}`);
  console.log(`   Total Failures: ${summary.totalFailures}`);
  console.log(`   Golden Failures: ${summary.goldenFailures} ⚠️`);
  console.log(`   Non-Golden Failures: ${summary.nonGoldenFailures}`);
  console.log(`   Affected Projects: ${summary.projects.join(', ')}\n`);

  if (goldenFailures.length > 0) {
    console.log('🔍 Detailed Golden Test Failures:');
    goldenFailures.forEach((failure, index) => {
      console.log(`   ${index + 1}. ${failure.project}/${failure.testFile}`);
      console.log(`      Status: ${failure.status}`);
      console.log(`      Failed Tests: ${failure.failures}/${failure.total}`);
      console.log(`      Duration: ${failure.duration}ms`);

      if (failure.failedTests && failure.failedTests.length > 0) {
        console.log(`      Failed Test Names:`);
        failure.failedTests.forEach((test) => {
          console.log(`        - ${test.title}`);
        });
      }
      console.log('');
    });
  }

  // Send Slack alert if needed
  await sendSlackAlert(goldenFailures, summary);

  // Exit with appropriate code
  if (summary.goldenFailures > 0) {
    console.log('❌ Golden tests are failing - immediate attention required!');
    process.exit(1);
  } else {
    console.log('✅ All golden tests are passing!');
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Golden Test Monitor failed:', error);
    process.exit(1);
  });
}

module.exports = {
  goldenTestConfig,
  parseTestResults,
  analyzeGoldenTestFailures,
  sendSlackAlert,
  main,
};
