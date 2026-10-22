import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createJestConfig } from './create-jest-config';

describe('createJestConfig', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should generate files with --js flag', async () => {
    await createJestConfig(tree, { js: true }, 'js');

    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(tree.read('jest.config.js', 'utf-8')).toMatchSnapshot();
    expect(tree.read('jest.preset.js', 'utf-8')).toMatchSnapshot();
  });

  it('should generate files ', async () => {
    await createJestConfig(tree, {}, 'js');

    expect(tree.exists('jest.config.ts')).toBeTruthy();
    expect(tree.read('jest.config.ts', 'utf-8')).toMatchSnapshot();
    expect(tree.read('jest.preset.js', 'utf-8')).toMatchSnapshot();
  });

  it('should make js jest files', async () => {
    await createJestConfig(tree, { js: true }, 'js');

    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(tree.exists('jest.preset.js')).toBeTruthy();
  });

  describe('root project', () => {
    it('should not add a monorepo jest.config.ts  to the project', async () => {
      await createJestConfig(tree, { rootProject: true }, 'js');

      expect(tree.exists('jest.config.ts')).toBeFalsy();
    });

    const projectConfig = `export default { displayName: 'my-project' };`;
    const workspaceConfig = `import { getJestProjectsAsync } from '@nx/jest';
export default async () => ({
  projects: await getJestProjectsAsync(),
  extraThing: "Goes Here"
});
`;

    it.each(['ts', 'js', 'cjs', 'mts'])(
      'should leave the root project jest.config.%s untouched',
      async (ext) => {
        tree.write(`jest.config.${ext}`, projectConfig);

        await createJestConfig(tree, { rootProject: false }, 'js');

        expect(tree.read(`jest.config.${ext}`, 'utf-8')).toEqual(projectConfig);
        expect(
          tree.listChanges().filter((c) => c.path.startsWith('jest.config.'))
        ).toHaveLength(1);
      }
    );

    it('should leave an existing workspace config untouched', async () => {
      tree.write('jest.config.ts', workspaceConfig);

      await createJestConfig(tree, { rootProject: false }, 'js');

      expect(tree.read('jest.config.ts', 'utf-8')).toEqual(workspaceConfig);
      expect(tree.exists('jest.config.app.ts')).toBe(false);
      expect(tree.exists('jest.config.lib.ts')).toBe(false);
    });
  });
});
