import {
  cleanupProject,
  getPackageManagerCommand,
  newProject,
  runCLI,
  runCommand,
  updateFile,
} from '@nx/e2e-utils';

describe('Oxlint bridge', () => {
  beforeEach(() => {
    newProject({ packages: ['@nx/eslint'] });
  });
  afterEach(() => cleanupProject());

  it.each(['mjs', 'cjs'])('executes the generated %s config', (format) => {
    runCommand(`${getPackageManagerCommand().addDev} eslint@9.39.4`);
    const configFile = `eslint.config.${format}`;
    updateFile(
      configFile,
      `${format === 'mjs' ? 'export default' : 'module.exports ='} [
        { rules: { eqeqeq: 'error', 'no-debugger': 'error', 'no-alert': 'error' } },
      ];`
    );
    updateFile(
      'tools/oxlint.config.ts',
      `const config: { rules: Record<string, string> } = {
        rules: { eqeqeq: 'error', 'no-debugger': 'off', 'no-alert': 'off' },
      };
      export default config;`
    );

    runCLI(
      'generate @nx/eslint:setup-oxlint-bridge --oxlintConfigPath=./tools/oxlint.config.ts'
    );
    updateFile(
      'check-bridge.mjs',
      `import assert from 'node:assert/strict';
      import { ESLint } from 'eslint';
      import config from './${configFile}';
      assert.ok(Array.isArray(config));
      const eslint = new ESLint({ overrideConfigFile: './${configFile}' });
      const effective = await eslint.calculateConfigForFile('example.js');
      assert.equal(effective.rules.eqeqeq[0], 0);
      assert.equal(effective.rules['no-debugger'][0], 2);
      assert.equal(effective.rules['no-alert'][0], 2);
      assert.equal(effective.linterOptions.reportUnusedDisableDirectives, 0);
      console.log('bridge config executed');`
    );

    expect(runCommand('node check-bridge.mjs')).toContain(
      'bridge config executed'
    );
  });
});
