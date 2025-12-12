import { createTree } from '../../generators/testing-utils/create-tree';
import addSelfHealingToGitignore, {
  updateGitIgnore,
  updatePrettierIgnore,
} from './add-self-healing-to-gitignore';

describe('addSelfHealingToGitignore', () => {
  describe('updateGitIgnore', () => {
    it('should add .nx/self-healing to gitignore', () => {
      const tree = createTree();
      tree.write('.gitignore', 'node_modules');
      updateGitIgnore(tree);
      expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
        "node_modules
        .nx/self-healing"
      `);
    });

    it('should work if .gitignore does not exist', () => {
      const tree = createTree();
      tree.delete('.gitignore');
      updateGitIgnore(tree);
      expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(
        `".nx/self-healing"`
      );
    });

    it('should not change gitignore if .nx/self-healing is directly ignored', () => {
      const tree = createTree();
      tree.write('.gitignore', 'node_modules\n.nx/self-healing');
      updateGitIgnore(tree);
      expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
        "node_modules
        .nx/self-healing"
      `);
    });

    it('should not change gitignore if .nx is ignored (covers .nx/self-healing)', () => {
      const tree = createTree();
      tree.write('.gitignore', 'node_modules\n.nx');
      updateGitIgnore(tree);
      expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
        "node_modules
        .nx"
      `);
    });

    it('should not change gitignore if ignored by glob pattern like .nx/*', () => {
      const tree = createTree();
      tree.write('.gitignore', 'node_modules\n.nx/*');
      updateGitIgnore(tree);
      expect(tree.read('.gitignore', 'utf-8')).toMatchInlineSnapshot(`
        "node_modules
        .nx/*"
      `);
    });
  });

  describe('updatePrettierIgnore', () => {
    it('should add .nx/self-healing to prettierignore', () => {
      const tree = createTree();
      tree.write('.prettierignore', '/dist');
      updatePrettierIgnore(tree);
      expect(tree.read('.prettierignore', 'utf-8')).toMatchInlineSnapshot(`
        "/dist
        /.nx/self-healing"
      `);
    });

    it('should not add if .prettierignore does not exist', () => {
      const tree = createTree();
      tree.delete('.prettierignore');
      updatePrettierIgnore(tree);
      expect(tree.exists('.prettierignore')).toBeFalsy();
    });

    it('should not add if already covered by pattern', () => {
      const tree = createTree();
      tree.write('.prettierignore', '/.nx');
      updatePrettierIgnore(tree);
      expect(tree.read('.prettierignore', 'utf-8')).toBe('/.nx');
    });
  });

  describe('full migration', () => {
    it('should update both gitignore and prettierignore', async () => {
      const tree = createTree();
      tree.write('.gitignore', 'node_modules');
      tree.write('.prettierignore', '/dist');

      await addSelfHealingToGitignore(tree);

      expect(tree.read('.gitignore', 'utf-8')).toContain('.nx/self-healing');
      expect(tree.read('.prettierignore', 'utf-8')).toContain(
        '.nx/self-healing'
      );
    });
  });
});
