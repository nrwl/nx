import { readNxJson, updateJson, updateNxJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import init from './init';

describe('init', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  describe('angular cache dir', () => {
    it('should add .angular to .gitignore', async () => {
      tree.write('.gitignore', '');

      await init(tree, { skipFormat: true });

      expect(tree.read('.gitignore', 'utf-8')).toContain('.angular');
    });

    it('should not add .angular to .gitignore when it already exists', async () => {
      tree.write(
        '.gitignore',
        `foo
bar

.angular

`
      );

      await init(tree, { skipFormat: true });

      const angularEntries = tree
        .read('.gitignore', 'utf-8')
        .match(/^.angular$/gm);
      expect(angularEntries).toHaveLength(1);
    });

    it('should add .angular to .prettierignore', async () => {
      tree.write('.prettierignore', '');

      await init(tree, { skipFormat: true });

      expect(tree.read('.prettierignore', 'utf-8')).toContain('.angular');
    });

    it('should not add .angular to .prettierignore when it already exists', async () => {
      tree.write(
        '.prettierignore',
        `/coverage
/dist

.angular

`
      );

      await init(tree, { skipFormat: true });

      const angularEntries = tree
        .read('.prettierignore', 'utf-8')
        .match(/^.angular$/gm);
      expect(angularEntries).toHaveLength(1);
    });

    it('should add configured angular cache dir to .gitignore and .prettierignore', async () => {
      tree.write('.gitignore', '');
      tree.write('.prettierignore', '');
      const nxJson = readNxJson(tree);
      updateNxJson(tree, {
        ...nxJson,
        cli: { cache: { path: 'node_modules/.cache/angular' } },
      } as any);

      await init(tree, { skipFormat: true });

      expect(tree.read('.gitignore', 'utf-8')).toContain(
        'node_modules/.cache/angular'
      );
      expect(tree.read('.prettierignore', 'utf-8')).toContain(
        'node_modules/.cache/angular'
      );
    });
  });

  describe('v15 support', () => {
    let tree: Tree;
    beforeEach(() => {
      tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      updateJson(tree, 'package.json', (json) => ({
        ...json,
        dependencies: {
          ...json.dependencies,
          '@angular/core': '~15.2.0',
        },
      }));
    });

    describe('angular cache dir', () => {
      it('should add .angular to .gitignore', async () => {
        tree.write('.gitignore', '');

        await init(tree, { skipFormat: true });

        expect(tree.read('.gitignore', 'utf-8')).toContain('.angular');
      });

      it('should not add .angular to .gitignore when it already exists', async () => {
        tree.write(
          '.gitignore',
          `foo
bar

.angular

`
        );

        await init(tree, { skipFormat: true });

        const angularEntries = tree
          .read('.gitignore', 'utf-8')
          .match(/^.angular$/gm);
        expect(angularEntries).toHaveLength(1);
      });

      it('should add .angular to .prettierignore', async () => {
        tree.write('.prettierignore', '');

        await init(tree, { skipFormat: true });

        expect(tree.read('.prettierignore', 'utf-8')).toContain('.angular');
      });

      it('should not add .angular to .prettierignore when it already exists', async () => {
        tree.write(
          '.prettierignore',
          `/coverage
/dist

.angular

`
        );

        await init(tree, { skipFormat: true });

        const angularEntries = tree
          .read('.prettierignore', 'utf-8')
          .match(/^.angular$/gm);
        expect(angularEntries).toHaveLength(1);
      });

      it('should add configured angular cache dir to .gitignore and .prettierignore', async () => {
        tree.write('.gitignore', '');
        tree.write('.prettierignore', '');
        const nxJson = readNxJson(tree);
        updateNxJson(tree, {
          ...nxJson,
          cli: { cache: { path: 'node_modules/.cache/angular' } },
        } as any);

        await init(tree, { skipFormat: true });

        expect(tree.read('.gitignore', 'utf-8')).toContain(
          'node_modules/.cache/angular'
        );
        expect(tree.read('.prettierignore', 'utf-8')).toContain(
          'node_modules/.cache/angular'
        );
      });
    });
  });
});
