// CJS wrapper: oxfmt is ESM-only, and jest's per-file VM context rejects the
// second load with "Provided module is not an instance of Module". Running the
// binary sidesteps that and still exercises real formatting.
//
// The config-file-only keys are stripped below, so the double drops exactly what
// `format()` drops.
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
    // `format()` takes `FormatConfig`; a config file takes `Oxfmtrc`, which adds
    // `overrides` and `ignorePatterns`. Handing those to the CLI would let the
    // double honour keys the real API ignores, so a test could pass on the CLI
    // applying an override that production has to apply itself.
    const { overrides, ignorePatterns, ...formatConfig } = options ?? {};
    writeFileSync(configPath, JSON.stringify(formatConfig), 'utf-8');

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

    return { code, errors: [] };
  } catch (e) {
    const stderr = (e.stderr || '').toString().trim();
    const message = stderr || e.message;
    // The real API returns a `codeframe` carrying the path and line, and
    // production prefers it over `message`. Passed through under the same key
    // so the shapes match.
    //
    // Note this does not actually reach production's codeframe branch: under
    // `--stdin-filepath` the CLI emits a single stderr line, so the newline
    // test below is always false. Exercising that branch needs the file-path
    // invocation, which does emit a frame.
    const codeframe = stderr.includes('\n') ? stderr : undefined;
    return { code: sourceText, errors: [{ message, codeframe }] };
  } finally {
    rmSync(configDir, { recursive: true, force: true });
  }
};

exports.defineConfig = (config) => config;
