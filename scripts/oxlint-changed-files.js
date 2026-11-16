const { spawnSync } = require('child_process');
const { existsSync } = require('fs');
const { dirname, join } = require('path');
const { readNxJson } = require('nx/src/config/nx-json');
const { chunkify } = require('nx/src/utils/chunkify');
const {
  parseFiles,
  splitArgsIntoNxArgsAndOverrides,
} = require('nx/src/utils/command-line-utils');
const { readFileIfExisting } = require('nx/src/utils/fileutils');
const { getIgnoreObject } = require('nx/src/utils/ignore');
const { output } = require('nx/src/utils/output');

// The files `nx format:check` checks: changes since the merge-base with the
// default base, plus uncommitted and untracked files. Like `nx format:check`,
// lint everything when they can't be listed.
const { nxArgs } = splitArgsIntoNxArgsAndOverrides(
  {},
  'affected',
  { printWarnings: false },
  readNxJson()
);
let chunks;
let ignoreArgs = [];
try {
  const files = getIgnoreObject().filter(
    parseFiles(nxArgs).files.filter((file) => existsSync(file))
  );
  chunks = files.length > 0 ? chunkify(files) : [];
} catch (err) {
  output.error({
    title:
      err?.message ||
      'Something went wrong when resolving the list of files for oxlint',
    bodyLines: ['Linting all files'],
  });
  // Oxlint's own walk reads .gitignore but not .nxignore.
  ignoreArgs = readFileIfExisting('.nxignore')
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith('#'))
    .map((pattern) => `--ignore-pattern=${pattern}`);
  chunks = [[]];
}

const oxlintBin = join(
  dirname(require.resolve('oxlint/package.json')),
  'bin',
  'oxlint'
);
let failed = false;
for (const chunk of chunks) {
  const result = spawnSync(
    process.execPath,
    [
      oxlintBin,
      '--no-error-on-unmatched-pattern',
      ...ignoreArgs,
      '--',
      ...chunk,
    ],
    { stdio: 'inherit' }
  );
  if (result.error) {
    throw result.error;
  }
  failed ||= result.status !== 0;
}
process.exitCode = failed ? 1 : 0;
