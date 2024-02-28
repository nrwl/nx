#!/usr/bin/env node

const { types, scopes } = require('./commitizen.js');

console.log('🐟🐟🐟 Validating git commit message 🐟🐟🐟');

const childProcess = require('child_process');

let gitLogCmd = 'git log -1 --no-merges';

const gitRemotes = childProcess
  .execSync('git remote -v')
  .toString()
  .trim()
  .split('\n');
const upstreamRemote = gitRemotes.find((remote) =>
  remote.includes('nrwl/nx.git')
);
if (upstreamRemote) {
  const upstreamRemoteIdentifier = upstreamRemote.split('\t')[0].trim();
  console.log(`Comparing against remote ${upstreamRemoteIdentifier}`);
  const currentBranch = childProcess
    .execSync('git branch --show-current')
    .toString()
    .trim();

  // exclude all commits already present in upstream/master
  gitLogCmd =
    gitLogCmd + ` ${currentBranch} ^${upstreamRemoteIdentifier}/master`;
} else {
  console.error(
    'No upstream remote found for nrwl/nx.git. Skipping comparison against upstream master.'
  );
}

const gitMessage = childProcess.execSync(gitLogCmd).toString().trim();

if (!gitMessage) {
  console.log('No commits found. Skipping commit message validation.');
  process.exit(0);
}

const allowedTypes = types.map((type) => type.value).join('|');
const allowedScopes = scopes.map((scope) => scope.value).join('|');

const commitMsgRegex = `(${allowedTypes})\\((${allowedScopes})\\)!?:\\s(([a-z0-9:\-\s])+)`;

const matchCommit = new RegExp(commitMsgRegex, 'g').test(gitMessage);
const matchRevert = /Revert/gi.test(gitMessage);
const matchRelease = /Release/gi.test(gitMessage);
const exitCode = +!(matchRelease || matchRevert || matchCommit);

if (exitCode === 0) {
  console.log('Commit ACCEPTED 👍');
} else {
  console.log(
    '[Error]: Oh no! 😦 Your commit message: \n' +
      '-------------------------------------------------------------------\n' +
      gitMessage +
      '\n-------------------------------------------------------------------' +
      '\n\n 👉️ Does not follow the commit message convention specified in the CONTRIBUTING.MD file.'
  );
  console.log('\ntype(scope): subject \n BLANK LINE \n body');
  console.log('\n');
  console.log(`possible types: ${allowedTypes}`);
  console.log(`possible scopes: ${allowedScopes} (if unsure use "core")`);
  console.log(
    '\nEXAMPLE: \n' +
      'feat(nx): add an option to generate lazy-loadable modules\n' +
      'fix(core)!: breaking change should have exclamation mark\n'
  );
}
process.exit(exitCode);
