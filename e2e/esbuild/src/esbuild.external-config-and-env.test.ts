import {
  cleanupProject,
  newProject,
  readJson,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateJson,
} from '@nx/e2e-utils';
import { join } from 'path';

describe('EsBuild Plugin - external config and env', () => {
  beforeEach(() => newProject());
  afterEach(() => cleanupProject());

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

  it('should bundle in non-sensitive NX_ environment variables', () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=esbuild`,
      {}
    );

    updateFile(
      `libs/${myPkg}/src/index.ts`,
      `
      console.log(process.env['NX_SOME_SECRET']);
      console.log(process.env['NX_SOME_TOKEN']);
      console.log(process.env['NX_PUBLIC_TEST']);
      `
    );

    runCLI(`build ${myPkg} --platform=browser`, {
      env: {
        NX_SOME_SECRET: 'secret',
        NX_SOME_TOKEN: 'secret',
        NX_PUBLIC_TEST: 'foobar',
      },
    });

    const output = runCommand(`node dist/libs/${myPkg}/index.cjs`, {
      failOnError: true,
    });
    expect(output).not.toMatch(/secret/);
    expect(output).toMatch(/foobar/);
  });
});


