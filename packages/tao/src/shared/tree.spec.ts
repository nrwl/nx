import { rmdirSync } from 'fs-extra';
import { lstatSync, readFileSync, writeFileSync } from 'fs';
import { dirSync } from 'tmp';
import * as path from 'path';
import { mkdirpSync } from 'fs-extra';
import { FileChange, FsTree, flushChanges } from './tree';

describe('tree', () => {
  describe('FsTree', () => {
    let dir;
    let tree: FsTree;
    beforeEach(() => {
      dir = dirSync().name;
      mkdirpSync(path.join(dir, 'parent/child'));
      writeFileSync(path.join(dir, 'root-file.txt'), 'root content');
      writeFileSync(
        path.join(dir, 'parent', 'parent-file.txt'),
        'parent content'
      );
      writeFileSync(
        path.join(dir, 'parent', 'child', 'child-file.txt'),
        'child content'
      );

      tree = new FsTree(dir, false, console);
    });

    afterEach(() => {
      rmdirSync(dir, { recursive: true });
    });

    it('should return no changes, when no changes are made', () => {
      expect(tree.listChanges()).toEqual([]);
    });

    it('should be able to read and write files', () => {
      expect(tree.read('parent/parent-file.txt').toString()).toEqual(
        'parent content'
      );

      tree.write('parent/parent-file.txt', 'new content');

      expect(tree.read('parent/parent-file.txt').toString()).toEqual(
        'new content'
      );

      expect(s(tree.listChanges())).toEqual([
        {
          path: 'parent/parent-file.txt',
          type: 'UPDATE',
          content: 'new content',
        },
      ]);

      flushChanges(dir, tree.listChanges());

      expect(
        readFileSync(path.join(dir, 'parent/parent-file.txt')).toString()
      ).toEqual('new content');
    });

    it('should be able to create files', () => {
      tree.write('parent/new-parent-file.txt', 'new parent content');
      tree.write('parent/new-child/new-child-file.txt', 'new child content');

      expect(tree.read('parent/new-parent-file.txt').toString()).toEqual(
        'new parent content'
      );
      expect(
        tree.read('parent/new-child/new-child-file.txt').toString()
      ).toEqual('new child content');

      expect(s(tree.listChanges())).toEqual([
        {
          path: 'parent/new-parent-file.txt',
          type: 'CREATE',
          content: 'new parent content',
        },
        {
          path: 'parent/new-child/new-child-file.txt',
          type: 'CREATE',
          content: 'new child content',
        },
      ]);

      flushChanges(dir, tree.listChanges());

      expect(
        readFileSync(path.join(dir, 'parent/new-parent-file.txt')).toString()
      ).toEqual('new parent content');
      expect(
        readFileSync(
          path.join(dir, 'parent/new-child/new-child-file.txt')
        ).toString()
      ).toEqual('new child content');
    });

    it('should be able to delete files', () => {
      tree.delete('parent/parent-file.txt');
      tree.write('parent/new-child/new-child-file.txt', 'new child content');
      tree.delete('parent/new-child/new-child-file.txt');

      expect(tree.read('parent/parent-file.txt')).toEqual(null);
      expect(tree.read('parent/new-child/new-child-file.txt')).toEqual(null);

      expect(s(tree.listChanges())).toEqual([
        { path: 'parent/parent-file.txt', type: 'DELETE', content: null },
      ]);

      flushChanges(dir, tree.listChanges());

      try {
        lstatSync(path.join(dir, 'parent/parent-file.txt')).isFile();
        fail('Should not reach');
      } catch (e) {}
    });

    it('should be able to rename files', () => {
      tree.write('parent/new-child/new-child-file.txt', 'new child content');
      tree.rename(
        'parent/new-child/new-child-file.txt',
        'renamed-new-child-file.txt'
      );
      tree.rename('root-file.txt', 'renamed-root-file.txt');

      expect(tree.read('parent/new-child/new-child-file.txt')).toEqual(null);
      expect(tree.read('root-file.txt')).toEqual(null);
      expect(tree.read('renamed-new-child-file.txt').toString()).toEqual(
        'new child content'
      );
      expect(tree.read('renamed-root-file.txt').toString()).toEqual(
        'root content'
      );

      expect(s(tree.listChanges())).toEqual([
        {
          path: 'renamed-new-child-file.txt',
          type: 'CREATE',
          content: 'new child content',
        },
        { path: 'root-file.txt', type: 'DELETE', content: null },
        {
          path: 'renamed-root-file.txt',
          type: 'CREATE',
          content: 'root content',
        },
      ]);

      flushChanges(dir, tree.listChanges());

      expect(
        readFileSync(path.join(dir, 'renamed-new-child-file.txt')).toString()
      ).toEqual('new child content');
      expect(
        readFileSync(path.join(dir, 'renamed-root-file.txt')).toString()
      ).toEqual('root content');
    });

    it('should be able to delete dirs', () => {
      tree.write('parent/new-child/new-child-file.txt', 'new child content');

      tree.delete('parent/new-child');
      tree.delete('parent/child');

      expect(s(tree.listChanges())).toEqual([
        { path: 'parent/child', type: 'DELETE', content: null },
      ]);

      flushChanges(dir, tree.listChanges());

      try {
        const q = lstatSync(path.join(dir, 'parent/child')).isDirectory();
        console.log(q);
        fail('Should not reach');
      } catch (e) {}

      try {
        lstatSync(path.join(dir, 'parent/new-child')).isDirectory();
        fail('Should not reach');
      } catch (e) {}
    });

    it('should return the list of children of a dir', () => {
      tree.write('parent/new-child/new-child-file.txt', 'new child content');

      expect(tree.children('parent/child')).toEqual(['child-file.txt']);
      expect(tree.children('parent/new-child')).toEqual(['new-child-file.txt']);

      tree.rename(
        'parent/child/child-file.txt',
        'parent/child/renamed-child-file.txt'
      );
      tree.rename(
        'parent/new-child/new-child-file.txt',
        'parent/new-child/renamed-new-child-file.txt'
      );

      expect(tree.children('parent/child')).toEqual(['renamed-child-file.txt']);
      expect(tree.children('parent/new-child')).toEqual([
        'renamed-new-child-file.txt',
      ]);
    });

    it('should be able to rename dirs', () => {
      // not supported yet
    });
  });

  function s(changes: FileChange[]) {
    return changes.map((f) => {
      if (f.content) (f as any).content = f.content.toString();
      return f;
    });
  }
});
