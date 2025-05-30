const fs = require('fs');
const path = require('path');

function processTestResults() {
  const testDir = 'test-results';
  const files = fs.readdirSync(testDir).filter(f => f.endsWith('.json'));
  
  const failures = [];
  let totalTests = 0;
  let totalFailed = 0;

  files.forEach(file => {
    try {
      const [project, os, nodeVer, pm] = file.replace('.json', '').split('-');
      const results = JSON.parse(fs.readFileSync(path.join(testDir, file), 'utf8'));
      
      if (results.numFailedTests > 0) {
        const envInfo = `${os}/${pm}/${nodeVer}`;
        const failedTests = results.testResults
          .flatMap(suite => suite.assertionResults)
          .filter(test => test.status === 'failed')
          .map(test => ({
            name: test.title,
            error: test.failureMessages[0].split('\n')[0] // Get first line of error
          }));

        failures.push({
          project,
          envInfo,
          failedTests
        });

        totalFailed += results.numFailedTests;
      }
      totalTests += results.numTotalTests;
    } catch (e) {
      console.error(`Error processing ${file}:`, e);
    }
  });

  if (failures.length === 0) {
    console.log('::set-output name=HAS_FAILURES::false');
    console.log('::set-output name=TEST_FAILURES::No test failures detected.');
    return;
  }

  console.log('::set-output name=HAS_FAILURES::true');

  // Group failures by project for cleaner output
  const byProject = failures.reduce((acc, curr) => {
    if (!acc[curr.project]) {
      acc[curr.project] = [];
    }
    acc[curr.project].push(curr);
    return acc;
  }, {});

  const summaryLine = `:warning: *${totalFailed} test${totalFailed > 1 ? 's' : ''} failed* across ${Object.keys(byProject).length} project${Object.keys(byProject).length > 1 ? 's' : ''}\n`;

  let message = [summaryLine];

  Object.entries(byProject).forEach(([project, envFailures]) => {
    message.push(`*${project}*`);
    envFailures.forEach(({ envInfo, failedTests }) => {
      message.push(`\`${envInfo}\``);
      failedTests.forEach(test => {
        message.push(`• \`${test.name}\`\n  ${test.error}`);
      });
    });
    message.push(''); // Add spacing between projects
  });

  console.log('::set-output name=TEST_FAILURES::' + message.join('\n'));
}

processTestResults(); 