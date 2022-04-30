import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import {
  addProjectConfiguration,
  readJson,
  stripIndents,
  writeJson,
} from '@nrwl/devkit';
import update from './replace-testing-library-react-hook';

describe('Remove deprecated hook testing package', () => {
  it('should replace imports for packages that has jest test target', async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(
      tree,
      'example',
      {
        root: 'apps/example',
        sourceRoot: 'apps/example/src',
        projectType: 'application',
        targets: {
          test: {
            executor: '@nrwl/jest:jest',
          },
        },
      },
      true
    );

    tree.write(
      `apps/example/src/lib/use-example.spec.ts`,
      `import { renderHook } from '@testing-library/react';`
    );

    await update(tree);

    expect(
      tree.read('apps/example/src/lib/use-example.spec.ts').toString()
    ).toEqual(`import { renderHook } from '@testing-library/react';`);
  });
});
