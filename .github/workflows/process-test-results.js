const fs = require('fs');
const path = require('path');

function processTestResults() {
  // Get expected matrix data
  const matrixData = process.env.MATRIX_DATA ? JSON.parse(process.env.MATRIX_DATA) : [];
  
  // Look for test results files in the current directory
  const files = fs.readdirSync('.')
    .filter(f => f.endsWith('.json'));
  
  const failures = [];
  const incompleteTests = [];
  let totalTests = 0;
  let totalFailed = 0;
  const projectStats = new Map(); // Track stats per project
  
  // Create a set of expected test result files based on matrix data
  const expectedFiles = new Set();
  matrixData.forEach(matrix => {
    const expectedFile = `${matrix.project}-${matrix.os_name}-${matrix.node_version}-${matrix.package_manager}.json`;
    expectedFiles.add(expectedFile);
    
    // Initialize project stats for all expected projects
    if (!projectStats.has(matrix.project)) {
      projectStats.set(matrix.project, { total: 0, failed: 0, environments: new Set(), incomplete: [] });
    }
    projectStats.get(matrix.project).environments.add(`${matrix.os_name}/${matrix.package_manager}/node${matrix.node_version}`);
  });
  
  // Find incomplete tests (expected but no JSON file)
  expectedFiles.forEach(expectedFile => {
    if (!files.includes(expectedFile)) {
      // Parse the filename to get project and environment info
      const nameWithoutExt = expectedFile.replace('.json', '');
      const parts = nameWithoutExt.split('-');
      
      const pm = parts[parts.length - 1];
      const nodeVer = parts[parts.length - 2];
      const os = parts[parts.length - 3];
      const project = parts.slice(0, parts.length - 3).join('-');
      
      incompleteTests.push({
        project,
        envInfo: `${os}/${pm}/node${nodeVer}`,
        expectedFile
      });
      
      // Track incomplete tests in project stats
      const stats = projectStats.get(project);
      if (stats) {
        stats.incomplete.push(`${os}/${pm}/node${nodeVer}`);
      }
    }
  });

  files.forEach(file => {
    try {
      // File name format: e2e-project-OS-nodeVersion-packageManager.json
      // We need to split from the right to handle multi-part project names
      const nameWithoutExt = file.replace('.json', '');
      const parts = nameWithoutExt.split('-');
      
      // Last 3 parts are always: OS, nodeVersion, packageManager
      const pm = parts[parts.length - 1];
      const nodeVer = parts[parts.length - 2];
      const os = parts[parts.length - 3];
      
      // Everything before that is the project name
      const project = parts.slice(0, parts.length - 3).join('-');
      
      console.log(`Processing: ${file} -> Project: ${project}, OS: ${os}, Node: ${nodeVer}, PM: ${pm}`);
      
      const results = JSON.parse(fs.readFileSync(file, 'utf8'));
      
      // Track project stats
      if (!projectStats.has(project)) {
        projectStats.set(project, { total: 0, failed: 0, environments: new Set() });
      }
      const stats = projectStats.get(project);
      stats.total += results.numTotalTests || 0;
      stats.failed += results.numFailedTests || 0;
      stats.environments.add(`${os}/${pm}/node${nodeVer}`);
      
      if (results.numFailedTests > 0) {
        const envInfo = `${os}/${pm}/node${nodeVer}`;
        
        // Extract test suite information (testResults contains suites)
        const failedSuites = results.testResults
          .filter(suite => suite.assertionResults && suite.assertionResults.some(test => test.status === 'failed'))
          .map(suite => {
            const failedTests = suite.assertionResults
              .filter(test => test.status === 'failed')
              .map(test => ({
                name: test.title,
                error: (test.failureMessages && test.failureMessages[0] ? test.failureMessages[0].split('\n')[0] : 'Unknown error')
              }));
            
            // Try multiple properties to get a meaningful suite name
            let suiteName = 'Unknown Suite';
            if (suite.name) {
              // Extract just the filename and remove common test extensions
              let filename = path.basename(suite.name);
              // Remove common test file extensions for cleaner display
              suiteName = filename
                .replace(/\.(spec|test|e2e)\.(ts|js)$/, '')
                .replace(/\.(ts|js)$/, '');
            } else if (suite.testFilePath) {
              let filename = path.basename(suite.testFilePath);
              suiteName = filename
                .replace(/\.(spec|test|e2e)\.(ts|js)$/, '')
                .replace(/\.(ts|js)$/, '');
            }

            return {
              suiteName,
              failedTests
            };
          });

        failures.push({
          project,
          envInfo,
          failedSuites
        });

        totalFailed += results.numFailedTests;
      }
      totalTests += results.numTotalTests || 0;
    } catch (e) {
      console.error(`Error processing ${file}:`, e);
    }
  });

  // Determine if we have any issues (failures or incomplete tests)
  const hasIssues = failures.length > 0 || incompleteTests.length > 0;

  if (!hasIssues) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `HAS_FAILURES=false\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `TEST_FAILURES=No golden test suite failures detected.\n`);
    
    // Add success summary
    let summary = [`:white_check_mark: *All Golden Test Suites Passed Successfully*`];
    summary.push('```');
    summary.push('| Project                        | Total Tests |');
    summary.push('|--------------------------------|-------------|');
    
    for (const [project, stats] of projectStats) {
      const projectName = project.padEnd(30);
      const totalTests = stats.total.toString().padEnd(11);
      summary.push(`| ${projectName} | ${totalTests} |`);
    }
    
    summary.push('```');
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

  // Group incomplete tests by project
  const incompleteByProject = incompleteTests.reduce((acc, curr) => {
    if (!acc[curr.project]) {
      acc[curr.project] = [];
    }
    acc[curr.project].push(curr);
    return acc;
  }, {});

  const totalFailedSuites = failures.reduce((acc, failure) => acc + failure.failedSuites.length, 0);
  const totalIncomplete = incompleteTests.length;
  
  let summaryLine = `:rotating_light: **Golden Test Suite Issues**\n`;
  if (totalFailed > 0) {
    summaryLine += `*${totalFailed} test${totalFailed > 1 ? 's' : ''} failed* in ${totalFailedSuites} golden test suite${totalFailedSuites > 1 ? 's' : ''}`;
  }
  if (totalIncomplete > 0) {
    if (totalFailed > 0) summaryLine += ` and `;
    summaryLine += `*${totalIncomplete} incomplete test${totalIncomplete > 1 ? 's' : ''}*`;
  }
  summaryLine += ` across ${Math.max(Object.keys(byProject).length, Object.keys(incompleteByProject).length)} project${Math.max(Object.keys(byProject).length, Object.keys(incompleteByProject).length) > 1 ? 's' : ''}\n`;

  let message = [summaryLine];

  // Add failures section if there are any
  if (failures.length > 0) {
    message.push(`_The following projects have golden test suite failures:_\n`);
    
    Object.entries(byProject).forEach(([project, envFailures]) => {
      const stats = projectStats.get(project);
      message.push(`*${project}*`);
      
      // Create a table for failed environments
      message.push(`• Failed Environments:`);
      message.push('```');
      message.push('| Environment            | Test Suite                | Failures |');
      message.push('|------------------------|---------------------------|----------|');
      
      envFailures.forEach(({ envInfo, failedSuites }) => {
        failedSuites.forEach(({ suiteName, failedTests }) => {
          const env = envInfo.padEnd(22);
          const suite = suiteName.padEnd(25);
          const failures = failedTests.length.toString().padEnd(8);
          message.push(`| ${env} | ${suite} | ${failures} |`);
        });
      });
      
      message.push('```');
      message.push(''); // Add spacing between projects
    });
  }

  // Add incomplete tests section if there are any
  if (incompleteTests.length > 0) {
    message.push(`_The following projects have incomplete golden test suites (no results produced):_\n`);
    
    Object.entries(incompleteByProject).forEach(([project, incompletes]) => {
      message.push(`*${project}*`);
      message.push(`• Incomplete Environments:`);
      message.push('```');
      message.push('| Environment            | Test Suite                |');
      message.push('|------------------------|---------------------------|');
      
      incompletes.forEach(({ envInfo }) => {
        const env = envInfo.padEnd(22);
        // Derive test suite name from project name (remove e2e- prefix and clean up)
        const testSuite = project.replace(/^e2e-/, '').padEnd(25);
        message.push(`| ${env} | ${testSuite} |`);
      });
      
      message.push('```');
      message.push(''); // Add spacing between projects
    });
  }

  // Use the new GitHub Actions output syntax for multiline strings
  const output = message.join('\n');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `TEST_FAILURES<<EOF\n${output}\nEOF\n`);
}

processTestResults();