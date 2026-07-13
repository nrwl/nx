import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { adaptSkillFilesToPackageManager } from './adapt-skill-files-to-package-manager';
import * as packageManager from '../../utils/package-manager';

describe('adaptSkillFilesToPackageManager', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should rewrite pnpm nx commands in skills for yarn workspaces', () => {
    jest.spyOn(packageManager, 'detectPackageManager').mockReturnValue('yarn');
    jest.spyOn(packageManager, 'getPackageManagerCommand').mockReturnValue({
      install: 'yarn',
      ciInstall: 'yarn install --immutable',
      updateLockFile: 'yarn install',
      add: 'yarn add',
      addDev: 'yarn add -D',
      rm: 'yarn remove',
      exec: 'yarn',
      dlx: 'yarn dlx',
      run: (script: string) => `yarn ${script}`,
      list: 'yarn info --name-only',
      why: 'yarn why',
      getRegistryUrl: 'yarn config get registry',
      publish: () => 'yarn publish',
    });

    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      '.cursor/skills/nx-plugins/SKILL.md',
      '# Plugins\n\n- List plugins: `pnpm nx list`\n- Install: `pnpm nx add @nx/react`\n'
    );

    adaptSkillFilesToPackageManager(tree, '.');

    const content = tree.read('.cursor/skills/nx-plugins/SKILL.md', 'utf-8');
    expect(content).toContain('`yarn nx list`');
    expect(content).toContain('`yarn nx add @nx/react`');
    expect(content).not.toContain('pnpm nx');
  });

  it('should leave skill files unchanged for pnpm workspaces', () => {
    jest.spyOn(packageManager, 'detectPackageManager').mockReturnValue('pnpm');

    const tree = createTreeWithEmptyWorkspace();
    const original =
      '# Plugins\n\n- List plugins: `pnpm nx list`\n';
    tree.write('.claude/skills/nx-plugins/SKILL.md', original);

    adaptSkillFilesToPackageManager(tree, '.');

    expect(tree.read('.claude/skills/nx-plugins/SKILL.md', 'utf-8')).toBe(
      original
    );
  });
});
