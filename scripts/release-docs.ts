import { execSync } from 'child_process';

// The GITHUB_REF_NAME is a full version (i.e. 17.3.2). The branchName will strip the patch version number.
// We will publish docs to the website branch based on the current tag (i.e. website-17)
console.log(`Comparing ${process.env.GITHUB_REF_NAME} to npm versions`);

const majorVersion = process.env.GITHUB_REF_NAME?.split('.')[0];
const minorVersion = process.env.GITHUB_REF_NAME?.split('.')
  .slice(0, 2)
  .join('.');
const releasedVersions: string[] = JSON.parse(
  execSync(`npm show nx@^${majorVersion} version --json`).toString()
);
const versionIsReleased =
  minorVersion &&
  releasedVersions.some((version) => version.includes(minorVersion));
const latestVersion = releasedVersions.slice().sort().pop();
const versionIsLatest = minorVersion && latestVersion?.includes(minorVersion);

console.log(`Found npm versions:\n${releasedVersions.join('\n')}`);

// Publish if the minor version is not released yet, or the minor version matches the latest version

const branchName = `website-${majorVersion}`;
if (!versionIsReleased || versionIsLatest) {
  console.log(
    `Publishing docs site for ${process.env.GITHUB_REF_NAME} to ${branchName}`
  );
  // We force recreate the branch in order to always be up to date and avoid merge conflicts within the automated workflow
  execSync(`git branch -f ${branchName}`);
  execSync(`git push -f origin ${branchName}`);
} else {
  console.log(`Not publishing docs to ${branchName}`);
}
