import { createTree } from 'nx/src/generators/testing-utils/create-tree';
import type { Tree } from 'nx/src/generators/tree';
import { visitNotIgnoredFiles } from './visit-not-ignored-files';

describe('visitNotIgnoredFiles', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should visit files recursively in a directory', () => {
    tree.write('dir/file1.ts', '');
    tree.write('dir/dir2/file2.ts', '');

    const visitor = jest.fn();
    visitNotIgnoredFiles(tree, 'dir', visitor);

    expect(visitor).toHaveBeenCalledWith('dir/file1.ts');
    expect(visitor).toHaveBeenCalledWith('dir/dir2/file2.ts');
  });

  it('should not visit ignored files in a directory', () => {
    tree.write('.gitignore', 'node_modules');

    tree.write('dir/file1.ts', '');
    tree.write('dir/node_modules/file1.ts', '');
    tree.write('dir/dir2/file2.ts', '');

    const visitor = jest.fn();
    visitNotIgnoredFiles(tree, 'dir', visitor);

    expect(visitor).toHaveBeenCalledWith('dir/file1.ts');
    expect(visitor).toHaveBeenCalledWith('dir/dir2/file2.ts');
    expect(visitor).not.toHaveBeenCalledWith('dir/node_modules/file1.ts');
  });

  it.each(['', '.', '/', './'])(
    'should be able to visit the root path "%s"',
    (dirPath) => {
      tree.write('.gitignore', 'node_modules');

      tree.write('dir/file1.ts', '');
      tree.write('dir/node_modules/file1.ts', '');
      tree.write('dir/dir2/file2.ts', '');

      const visitor = jest.fn();
      visitNotIgnoredFiles(tree, dirPath, visitor);

      expect(visitor).toHaveBeenCalledWith('.gitignore');
      expect(visitor).toHaveBeenCalledWith('dir/file1.ts');
      expect(visitor).toHaveBeenCalledWith('dir/dir2/file2.ts');
      expect(visitor).not.toHaveBeenCalledWith('dir/node_modules/file1.ts');
    }
  );

  describe('nested ignore files', () => {
    function visitAll() {
      const visited: string[] = [];
      visitNotIgnoredFiles(tree, '', (p) => visited.push(p));
      return visited;
    }

    it('should honour a .gitignore in a subdirectory', () => {
      tree.write('apps/foo/.gitignore', 'skip.ts\n');
      tree.write('apps/foo/skip.ts', '');
      tree.write('apps/foo/kept.ts', '');
      // The same name elsewhere is outside that file's reach.
      tree.write('apps/bar/skip.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/skip.ts');
      expect(visited).toContain('apps/foo/kept.ts');
      expect(visited).toContain('apps/bar/skip.ts');
    });

    it('should anchor a nested pattern at its own directory', () => {
      // A bare filename matches at any depth, so it passes whether or not the
      // path is rebased. A leading slash is what actually pins the rebasing.
      tree.write('apps/foo/.gitignore', '/generated/\n');
      tree.write('apps/foo/generated/a.ts', '');
      tree.write('generated/b.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/generated/a.ts');
      expect(visited).toContain('generated/b.ts');
    });

    it('should let a nested negation re-include a file the root ignored', () => {
      // git overrides higher-level patterns with lower-level ones.
      tree.write('.gitignore', '*.log\n');
      tree.write('apps/foo/.gitignore', '!keep.log\n');
      tree.write('apps/foo/keep.log', '');
      tree.write('apps/foo/other.log', '');
      tree.write('apps/bar/keep.log', '');

      const visited = visitAll();

      expect(visited).toContain('apps/foo/keep.log');
      expect(visited).not.toContain('apps/foo/other.log');
      expect(visited).not.toContain('apps/bar/keep.log');
    });

    it('should honour a .nxignore in a subdirectory', () => {
      tree.write('apps/foo/.nxignore', 'skip.ts\n');
      tree.write('apps/foo/skip.ts', '');
      tree.write('apps/foo/kept.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/skip.ts');
      expect(visited).toContain('apps/foo/kept.ts');
    });

    it('should skip a directory a nested ignore file excludes', () => {
      tree.write('apps/foo/.gitignore', 'dist/\n');
      tree.write('apps/foo/dist/deep/a.ts', '');
      tree.write('apps/foo/src/b.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('apps/foo/dist/deep/a.ts');
      expect(visited).toContain('apps/foo/src/b.ts');
    });

    it('should never visit .git, even with no .gitignore present', () => {
      tree.write('.git/config', '');
      tree.write('a.ts', '');

      const visited = visitAll();

      expect(visited).not.toContain('.git/config');
      expect(visited).toContain('a.ts');
    });
  });
});
