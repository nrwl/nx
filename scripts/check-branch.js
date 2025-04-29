const { execSync } = require('child_process');
const branchName = execSync('git rev-parse --abbrev-ref HEAD')
  .toString()
  .trim();

process.stdout.write('Pushing to branch: ' + branchName + '\n');

if (
  branchName.includes('master') &&
  !(process.env.CI && process.env.CI !== 'false')
) {
  console.error(
    'You are on the master branch. Please checkout to another branch before pushing.'
  );
  process.exitCode = 1;
}
