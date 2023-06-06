import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Tree, readJson } from '@nx/devkit';
import * as nxDevkit from '@nx/devkit';
import * as semver from 'semver';

import { preCommitChecksGenerator } from './generator';
import { PreCommitChecksGeneratorSchema } from './schema';

describe('pre-commit-checks generator', () => {
  let tree: Tree;
  const defaultOptions: PreCommitChecksGeneratorSchema = { skipFormat: true };

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generating files and installing required dependencies for each package manager', () => {
    test.each`
      packageManager | isYarn2  | enableCommitlint
      ${'npm'}       | ${false} | ${undefined}
      ${'pnpm'}      | ${false} | ${undefined}
      ${'yarn'}      | ${false} | ${undefined}
      ${'yarn'}      | ${true}  | ${undefined}
      ${'npm'}       | ${false} | ${false}
      ${'pnpm'}      | ${false} | ${false}
      ${'yarn'}      | ${false} | ${false}
      ${'yarn'}      | ${true}  | ${false}
    `(
      'should correctly install dependencies when packageManager is $packageManager ($isYarn2) and enableCommitlint is $enableCommitlint',
      async ({ packageManager, isYarn2, enableCommitlint }) => {
        jest.spyOn(nxDevkit, 'readNxJson').mockReturnValueOnce({
          cli: {
            packageManager,
          },
        });

        if (isYarn2) {
          jest.spyOn(semver, 'gte').mockImplementation((v1, v2) => {
            if (v2 === '2.0.0') {
              // trying to assume that current invocation of "gte" is for yarn
              // as we're checking if yarn's version is greater than 2.0.0
              return true;
            }
            return semver.gte(v1, v2);
          });
        }

        await preCommitChecksGenerator(tree, {
          ...defaultOptions,
          enableCommitlint,
        });

        const expectedFiles = ['.husky/pre-commit', '.lintstagedrc.mjs'];
        const expectedDeps = ['husky', 'lint-staged'];

        if (enableCommitlint !== false) {
          expectedFiles.push('.husky/commit-msg', '.commitlintrc.js');
          expectedDeps.push(
            '@commitlint/cli',
            '@commitlint/config-conventional'
          );
        }

        const { devDependencies } = readJson(tree, 'package.json');

        expect(Object.keys(devDependencies).sort()).toEqual(
          expectedDeps.sort()
        );
        expect(expectedFiles.every((f) => tree.exists(f))).toBeTruthy();
      }
    );
  });
});
