import { runCLI, runCommand, uniq, updateFile } from '@nx/e2e-utils';

import { setupEsbuildSuite } from './esbuild.setup';

describe('Esbuild environment variables', () => {
  setupEsbuildSuite();

  it('should bundle in non-sensitive NX_ environment variables', () => {
    const myPkg = uniq('my-pkg');
    runCLI(
      `generate @nx/js:lib ${myPkg} --directory=libs/${myPkg} --bundler=esbuild`
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
