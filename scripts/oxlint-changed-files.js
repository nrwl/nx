const { spawnSync } = require('child_process');
const { existsSync } = require('fs');
const { dirname, join } = require('path');
const { readNxJson } = require('nx/src/config/nx-json');
const { chunkify } = require('nx/src/utils/chunkify');
const {
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} = require('nx/src/utils/command-line-utils');

// The files `nx format:check` checks: changes since the merge-base with the
// default base, plus uncommitted and untracked files.
const { nxArgs } = splitArgsIntoNxArgsAndOverrides(
  {},
  'affected',
  { printWarnings: false },
  readNxJson()
);
const files = parseFiles(nxArgs).files.filter((file) => existsSync(file));

if (files.length > 0) {
  const oxlintBin = join(
    dirname(require.resolve('oxlint/package.json')),
    'bin',
    'oxlint'
  );
  let failed = false;
  for (const chunk of chunkify(files)) {
    const result = spawnSync(
      process.execPath,
      [oxlintBin, '--no-error-on-unmatched-pattern', '--', ...chunk],
      { stdio: 'inherit' }
    );
    if (result.error) {
      throw result.error;
    }
    failed ||= result.status !== 0;
  }
  process.exitCode = failed ? 1 : 0;
}
