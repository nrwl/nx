import { readJson, updateJson, type Tree } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rcompare } from 'semver';
import migration from './upgrade-to-angular-22-3';

describe('upgrade-to-angular-22-3 migration', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  function declare(
    dependencies: Record<string, string>,
    devDependencies: Record<string, string> = {}
  ): void {
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies,
      devDependencies,
    }));
  }

  it('should update the declared Angular packages of a workspace on Angular 22.2', async () => {
    declare(
      { '@angular/common': '~22.2.0', '@angular/core': '~22.2.0' },
      { '@angular/cli': '~22.2.0', '@angular-devkit/architect': '~0.2202.0' }
    );

    await migration(tree);

    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    expect(dependencies).toEqual({
      '@angular/common': '~22.3.0',
      '@angular/core': '~22.3.0',
    });
    expect(devDependencies).toEqual({
      '@angular/cli': '~22.3.0',
      '@angular-devkit/architect': '~0.2203.0',
    });
  });

  it('should keep a workspace the Angular 22.2 upgrade kept on 22.1', async () => {
    declare({ '@angular/core': '~22.1.0' }, { '@angular/cli': '~22.1.0' });
    const packageJson = tree.read('package.json', 'utf-8');

    await migration(tree);

    expect(tree.read('package.json', 'utf-8')).toBe(packageJson);
  });

  it('should update Angular packages declared through a pnpm catalog', async () => {
    const tempFs = new TempFs('upgrade-to-angular-22-3');
    try {
      tree.root = tempFs.tempDir;
      tempFs.createFileSync('pnpm-lock.yaml', 'lockfileVersion: 9.0');
      tree.write(
        'pnpm-workspace.yaml',
        `catalog:
  '@angular/core': ~22.2.0
`
      );
      declare({ '@angular/core': 'catalog:' });

      await migration(tree);

      expect(readJson(tree, 'package.json').dependencies).toEqual({
        '@angular/core': 'catalog:',
      });
      expect(tree.read('pnpm-workspace.yaml', 'utf-8')).toContain(
        "'@angular/core': ~22.3.0"
      );
    } finally {
      tempFs.cleanup();
    }
  });

  // A workspace starting on Angular 22.1 never gets the newest Angular update
  // group, so this migration has to reach the same version.
  it('should update @angular/core to the version of the newest Angular update group', async () => {
    const { packageJsonUpdates } = JSON.parse(
      readFileSync(join(__dirname, '../../../migrations.json'), 'utf-8')
    );
    const [newestGroup] = Object.values<{
      version: string;
      packages: Record<string, { version: string }>;
    }>(packageJsonUpdates)
      .filter((group) => group.packages['@angular/core'])
      .sort((a, b) => rcompare(a.version, b.version));
    declare({ '@angular/core': '~22.2.0' });

    await migration(tree);

    expect(readJson(tree, 'package.json').dependencies['@angular/core']).toBe(
      newestGroup.packages['@angular/core'].version
    );
  });
});
