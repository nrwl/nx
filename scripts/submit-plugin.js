const open = require('open');
const childProcess = require('child_process');

function createPullRequest() {
  const remoteUrl = childProcess
    .execSync(`git ls-remote --get-url origin`)
    .toString('utf-8')
    .trim();
  const remoteName = remoteUrl.match(/[\/|:](\w+?)\//)[1];
  const branchName = childProcess
    .execSync('git rev-parse --abbrev-ref HEAD')
    .toString('utf-8')
    .trim();
  const prUrl = `https://github.com/nrwl/nx/compare/master...${remoteName}:${branchName}?expand=1&template=COMMUNITY_PLUGIN.md`;
  open(prUrl);
}

createPullRequest();
