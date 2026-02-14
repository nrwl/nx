import { execSync } from 'child_process';

export function checkForUncommittedChanges() {
  const gitResult = execSync('git status --porcelain', {
    windowsHide: true,
  }).toString();

  const filteredResults = gitResult
    .split('\n')
    .filter((line) => !line.includes('.nx') && line.trim().length > 0);

  if (filteredResults.length > 0) {
    console.log('❗️ Careful!');
    console.log('You have uncommitted changes in your repository.');
    console.log('');
    console.log(filteredResults.join('\n').toString());
    console.log('Please commit your changes before running the migrator!');
    process.exit(1);
  }
}
