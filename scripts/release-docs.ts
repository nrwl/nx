import { execSync } from 'child_process';
import { gte, major, maxSatisfying } from 'semver';

// The GITHUB_REF_NAME is a full version (i.e. 17.3.2). The branchName will strip the patch version number.
// We will publish docs to the website branch based on the current tag (i.e. website-17)
const currentVersion = process.env.GITHUB_REF_NAME || '';
console.log(`Comparing ${currentVersion} to npm versions`);

const majorVersion = major(currentVersion);
const releasedVersions: string[] = JSON.parse(
  execSync(`npm show nx@^${majorVersion} version --json`).toString()
);

const latestVersion = maxSatisfying(releasedVersions, `^${majorVersion}`);

console.log(`Found npm versions:\n${releasedVersions.join('\n')}`);

// Publish if the current version is greater than or equal to the latest released version

const branchName = `website-${majorVersion}`;
if (currentVersion && latestVersion && gte(currentVersion, latestVersion)) {
  console.log(
    `Publishing docs site for ${process.env.GITHUB_REF_NAME} to ${branchName}`
  );
  // We force recreate the branch in order to always be up to date and avoid merge conflicts within the automated workflow
  execSync(`git branch -f ${branchName}`);
  execSync(`git push -f origin ${branchName}`);
} else {
  console.log(`Not publishing docs to ${branchName}`);
}
