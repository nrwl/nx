#!/usr/bin/env node

const { types, scopes } = require('./commitizen.js');
const fs = require('fs');
const childProcess = require('child_process');

function validateCommitMessage(message) {
  const allowedTypes = types.map((type) => type.value).join('|');
  const allowedScopes = scopes.map((scope) => scope.value).join('|');

  const commitMsgRegex = `(${allowedTypes})\\((${allowedScopes})\\)!?:\\s(([a-z0-9:\\-\\s])+)`;

  const matchCommit = new RegExp(commitMsgRegex, 'g').test(message);
  const matchRevert = /Revert/gi.test(message);
  const matchRelease = /Release/gi.test(message);
  const matchWip = /wip/gi.test(message);

  const isValid = matchRelease || matchRevert || matchCommit || matchWip;

  return {
    isValid,
    allowedTypes,
    allowedScopes,
    message,
  };
}

// Export for reuse
module.exports = { validateCommitMessage };

// CLI execution
if (require.main === module) {
  console.log('🐟🐟🐟 Validating git commit message 🐟🐟🐟');

  let gitMessage;

  // Check if a commit message file is provided (commit-msg hook)
  const commitMsgFile = process.argv[2];
  if (commitMsgFile) {
    gitMessage = fs.readFileSync(commitMsgFile, 'utf8').trim();
  } else {
    // Original logic for post-push validation
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

    gitMessage = childProcess.execSync(gitLogCmd).toString().trim();
  }

  if (!gitMessage) {
    console.log('No commits found. Skipping commit message validation.');
    process.exit(0);
  }

  const result = validateCommitMessage(gitMessage);
  const exitCode = result.isValid ? 0 : 1;

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
    console.log(`possible types: ${result.allowedTypes}`);
    console.log(
      `possible scopes: ${result.allowedScopes} (if unsure use "core")`
    );
    console.log(
      '\nEXAMPLE: \n' +
        'feat(nx): add an option to generate lazy-loadable modules\n' +
        'fix(core)!: breaking change should have exclamation mark\n'
    );
  }
  process.exit(exitCode);
}
