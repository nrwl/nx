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
});
