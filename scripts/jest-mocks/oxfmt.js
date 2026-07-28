// CJS wrapper for oxfmt to avoid ESM issues in Jest - oxfmt is ESM-only.
//
// Jest keeps a VM context per test file while Node keeps one module registry
// per process, so the second test file to load oxfmt is handed the first one's
// module and rejects it with "Provided module is not an instance of Module".
// Running the binary sidesteps that: it is the same formatter, so the tests
// still exercise real formatting rather than a stub.
const { execFileSync } = require('child_process');
const { mkdtempSync, rmSync, writeFileSync } = require('fs');
const { tmpdir } = require('os');
const path = require('path');

const packageJsonPath = require.resolve('oxfmt/package.json', {
  paths: [path.join(__dirname, '../../node_modules')],
});
const packageJson = require(packageJsonPath);
const oxfmtBin = path.resolve(
  path.dirname(packageJsonPath),
  typeof packageJson.bin === 'string' ? packageJson.bin : packageJson.bin.oxfmt
);

// Mirrors oxfmt's `format(fileName, sourceText, options)`, which resolves to
// `{ code, errors }` and reports a file it cannot handle through `errors`
// rather than by throwing.
exports.format = async function format(fileName, sourceText, options) {
  // The API takes options directly and never looks for a config file, so one is
  // always written - otherwise the binary would walk up from the file's path and
  // pick up config the API would not have applied. Running in that directory
  // keeps it from finding a stray .editorconfig for the same reason.
  const configDir = mkdtempSync(path.join(tmpdir(), 'nx-oxfmt-jest-'));
  try {
    const configPath = path.join(configDir, '.oxfmtrc.json');
    writeFileSync(configPath, JSON.stringify(options ?? {}), 'utf-8');

    const code = execFileSync(
      'node',
      [oxfmtBin, `--stdin-filepath=${fileName}`, '--config', configPath],
      {
        cwd: configDir,
        input: sourceText,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    );

    // oxfmt exits 0 for a file it has no parser for, and says so on stderr.
    return { code: code || sourceText, errors: [] };
  } catch (e) {
    const message = (e.stderr || '').toString().trim() || e.message;
    return { code: sourceText, errors: [{ message }] };
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }
};

exports.defineConfig = (config) => config;
