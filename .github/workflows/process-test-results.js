const fs = require('fs');
const path = require('path');

function processTestResults() {
  const files = fs.readdirSync('.').filter(f => f.endsWith('.json'));
  
  const failures = [];
  let totalTests = 0;
  let totalFailed = 0;
  const projectStats = new Map(); // Track stats per project

  files.forEach(file => {
    try {
      const [project, os, nodeVer, pm] = file.replace('.json', '').split('-');
      const results = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      // Track project stats
      if (!projectStats.has(project)) {
        projectStats.set(project, { total: 0, failed: 0, environments: new Set() });
      }
      const stats = projectStats.get(project);
      stats.total += results.numTotalTests;
      stats.failed += results.numFailedTests;
      stats.environments.add(`${os}/${pm}/node${nodeVer}`);
      
      if (results.numFailedTests > 0) {
        const envInfo = `${os}/${pm}/node${nodeVer}`;
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
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `HAS_FAILURES=false\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `TEST_FAILURES=No test failures detected.\n`);
    
    // Add success summary
    let summary = [`:white_check_mark: *All Tests Passed Successfully*`];
    for (const [project, stats] of projectStats) {
      summary.push(`\n*${project}*`);
      summary.push(`• Total Tests: ${stats.total}`);
      summary.push(`• Environments: ${Array.from(stats.environments).map(e => `\`${e}\``).join(', ')}`);
    }
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `TEST_SUMMARY=${summary.join('\n')}\n`);
    return;
  }

  fs.appendFileSync(process.env.GITHUB_OUTPUT, `HAS_FAILURES=true\n`);

  // Group failures by project for cleaner output
  const byProject = failures.reduce((acc, curr) => {
    if (!acc[curr.project]) {
      acc[curr.project] = [];
    }
    acc[curr.project].push(curr);
    return acc;
  }, {});

  const summaryLine = `:rotating_light: *${totalFailed} test${totalFailed > 1 ? 's' : ''} failed* out of ${totalTests} total tests across ${Object.keys(byProject).length} project${Object.keys(byProject).length > 1 ? 's' : ''}\n`;

  let message = [summaryLine];

  Object.entries(byProject).forEach(([project, envFailures]) => {
    const stats = projectStats.get(project);
    message.push(`*${project}*`);
    message.push(`• Total Tests: ${stats.total}, Failed: ${stats.failed}`);
    message.push(`• All Environments: ${Array.from(stats.environments).map(e => `\`${e}\``).join(', ')}`);
    message.push(`• Failed Environments:`);
    
    envFailures.forEach(({ envInfo, failedTests }) => {
      message.push(`  \`${envInfo}\``);
      failedTests.forEach(test => {
        message.push(`    • \`${test.name}\`\n      ${test.error}`);
      });
    });
    message.push(''); // Add spacing between projects
  });

  // Use the new GitHub Actions output syntax for multiline strings
  const output = message.join('\n');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `TEST_FAILURES<<EOF\n${output}\nEOF\n`);
}

processTestResults(); 