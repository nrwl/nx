import { runCLI, uniq, updateFile, updateJson } from '@nx/e2e-utils';
import { join } from 'path';
import { setupEsbuildTest, cleanupEsbuildTest } from './esbuild-setup';

describe('EsBuild Plugin - Basic - External Config', () => {
  let proj: string;

  beforeEach(() => (proj = setupEsbuildTest()));

  afterEach(() => cleanupEsbuildTest());

  it('should support external esbuild.config.js file', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=esbuild`
    );
    updateFile(
      `libs/${myPkg}/esbuild.config.js`,
      `console.log('custom config loaded');\nmodule.exports = {};\n`
    );
    updateJson(join('libs', myPkg, 'project.json'), (json) => {
      delete json.targets.build.options.esbuildOptions;
      json.targets.build.options.esbuildConfig = `libs/${myPkg}/esbuild.config.js`;
      return json;
    });

    const output = runCLI(`build ${myPkg}`);
    expect(output).toContain('custom config loaded');
  }, 120_000);

  it('should support external TypeScript esbuild.config.ts file', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=esbuild`
    );
    // The config imports a sibling TS module by extensionless path and uses
    // TS-only syntax. Raw require() can't resolve the extensionless '.ts'
    // import (and can't parse the TS syntax on Node without native type
    // stripping), so this only builds through the transpiled loadConfigFile path.
    updateFile(
      `libs/${myPkg}/noop.plugin.ts`,
      `import type { Plugin } from 'esbuild';\n\nexport const noopPlugin: Plugin = {\n  name: 'noop',\n  setup() {\n    console.log('noop plugin setup ran');\n  },\n};\n`
    );
    updateFile(
      `libs/${myPkg}/esbuild.config.ts`,
      `import type { BuildOptions } from 'esbuild';\nimport { noopPlugin } from './noop.plugin';\n\nconsole.log('custom ts config loaded');\n\nexport default {\n  plugins: [noopPlugin],\n} satisfies BuildOptions;\n`
    );
    updateJson(join('libs', myPkg, 'project.json'), (json) => {
      delete json.targets.build.options.esbuildOptions;
      json.targets.build.options.esbuildConfig = `libs/${myPkg}/esbuild.config.ts`;
      return json;
    });

    const output = runCLI(`build ${myPkg}`);
    expect(output).toContain('custom ts config loaded');
    // Proves the imported TS plugin reached esbuild and its setup() ran,
    // not just that the config module evaluated.
    expect(output).toContain('noop plugin setup ran');
  }, 120_000);
});
