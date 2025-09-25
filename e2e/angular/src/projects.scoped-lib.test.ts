import { checkFilesExist, runCLI, uniq } from '@nx/e2e-utils';

import { setupAngularProjectsSuite } from './projects.setup';

describe('Angular Projects - scoped libs', () => {
  setupAngularProjectsSuite();

  it('should support generating libraries with a scoped name when', () => {
    const libName = uniq('@my-org/lib1');

    runCLI(`generate @nx/angular:lib ${libName} --buildable --standalone`);

    checkFilesExist(
      `${libName}/src/index.ts`,
      `${libName}/src/lib/${libName.split('/')[1]}/${libName.split('/')[1]}.ts`
    );
    expect(() => runCLI(`build ${libName}`)).not.toThrow();
    expect(() => runCLI(`test ${libName}`)).not.toThrow();
  }, 500_000);
});

