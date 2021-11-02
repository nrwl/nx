import { lstatSync, readFileSync, writeFileSync } from 'fs';
import { removeSync, ensureDirSync } from 'fs-extra';
import { dirSync } from 'tmp';
import * as path from 'path';
import { FileChange, FsTree, flushChanges, TreeWriteOptions } from './tree';

describe('tree', () => {
  describe('FsTree', () => {
    let dir: string;
    let tree: FsTree;

    beforeEach(() => {
      dir = dirSync().name;
      ensureDirSync(path.join(dir, 'parent/child'));
      writeFileSync(path.join(dir, 'root-file.txt'), 'root content');
      writeFileSync(
        path.join(dir, 'parent', 'parent-file.txt'),
        'parent content'
      );
      writeFileSync(
        path.join(dir, 'parent', 'parent-file-with-write-options.txt'),
        'parent content with write options'
      );
      writeFileSync(
        path.join(dir, 'parent', 'child', 'child-file.txt'),
        'child content'
      );

      tree = new FsTree(dir, false);
    });

    afterEach(() => {
      removeSync(dir);
    });

    it('should return no changes, when no changes are made', () => {
      expect(tree.listChanges()).toEqual([]);
    });

    it('should be able to read and write files with Buffers', () => {
      expect(tree.read('parent/parent-file.txt')).toEqual(
        Buffer.from('parent content')
      );

      tree.write('parent/parent-file.txt', Buffer.from('new content'));

      expect(tree.read('parent/parent-file.txt')).toEqual(
        Buffer.from('new content')
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
        readFileSync(path.join(dir, 'parent/parent-file.txt'), 'utf-8')
      ).toEqual('new content');
    });

    it('should be able to read and write files with encodings and strings', () => {
      const writeOptions: TreeWriteOptions = { mode: '755' };
      expect(tree.read('parent/parent-file.txt', 'utf-8')).toEqual(
        'parent content'
      );

      tree.write('parent/parent-file.txt', 'new content');
      tree.write(
        'parent/parent-file-with-write-options.txt',
        'new content with write options',
        writeOptions
      );

      expect(tree.read('parent/parent-file.txt', 'utf-8')).toEqual(
        'new content'
      );

      expect(
        tree.read('parent/parent-file-with-write-options.txt').toString()
      ).toEqual('new content with write options');

      expect(s(tree.listChanges())).toEqual([
        {
          path: 'parent/parent-file.txt',
          type: 'UPDATE',
          content: 'new content',
        },
        {
          path: 'parent/parent-file-with-write-options.txt',
          type: 'UPDATE',
          content: 'new content with write options',
          options: writeOptions,
        },
      ]);

      flushChanges(dir, tree.listChanges());

      expect(
        readFileSync(path.join(dir, 'parent/parent-file.txt'), 'utf-8')
      ).toEqual('new content');
    });

    it('should not record a change if writing the file with no changes to the content', () => {
      tree.write('root-file.txt', 'root content');

      expect(tree.listChanges().length).toEqual(0);
    });

    it('should not record a change if writing a file with changes then reverting it back to existing content', () => {
      tree.write('root-file.txt', 'changed content');
      tree.write('root-file.txt', 'root content');

      expect(tree.listChanges()).toEqual([]);
    });

    it('should be able to create files', () => {
      const writeOptions: TreeWriteOptions = { mode: '755' };
      tree.write('parent/new-parent-file.txt', 'new parent content');
      tree.write(
        'parent/new-parent-file-with-write-options.txt',
        'new parent content with write options',
        writeOptions
      );
      tree.write('parent/new-child/new-child-file.txt', 'new child content');

      expect(tree.read('parent/new-parent-file.txt', 'utf-8')).toEqual(
        'new parent content'
      );
      expect(
        tree
          .read('parent/new-parent-file-with-write-options.txt', 'utf-8')
          .toString()
      ).toEqual('new parent content with write options');
      expect(
        tree.read('parent/new-child/new-child-file.txt', 'utf-8').toString()
      ).toEqual('new child content');

      expect(s(tree.listChanges())).toEqual([
        {
          path: 'parent/new-parent-file.txt',
          type: 'CREATE',
          content: 'new parent content',
        },
        {
          path: 'parent/new-parent-file-with-write-options.txt',
          type: 'CREATE',
          content: 'new parent content with write options',
          options: writeOptions,
        },
        {
          path: 'parent/new-child/new-child-file.txt',
          type: 'CREATE',
          content: 'new child content',
        },
      ]);

      flushChanges(dir, tree.listChanges());

      expect(
        readFileSync(path.join(dir, 'parent/new-parent-file.txt'), 'utf-8')
      ).toEqual('new parent content');
      expect(
        readFileSync(
          path.join(dir, 'parent/new-parent-file-with-write-options.txt'),
          'utf-8'
        ).toString()
      ).toEqual('new parent content with write options');
      expect(
        lstatSync(
          path.join(dir, 'parent/new-parent-file-with-write-options.txt')
        ).mode & octal(writeOptions.mode)
      ).toEqual(octal(writeOptions.mode));
      expect(
        readFileSync(
          path.join(dir, 'parent/new-child/new-child-file.txt'),
          'utf-8'
        ).toString()
      ).toEqual('new child content');
    });

    it('should normalize paths', () => {
      tree.write('dir/file1', 'File 1 Contents');
      tree.write('/dir/file2', 'File 2 Contents');
      tree.write('./dir/file3', 'File 3 Contents');

      expect(tree.read('dir/file1', 'utf-8')).toEqual('File 1 Contents');
      expect(tree.read('/dir/file1', 'utf-8')).toEqual('File 1 Contents');
      expect(tree.read('./dir/file1', 'utf-8')).toEqual('File 1 Contents');

      expect(tree.read('dir/file2', 'utf-8')).toEqual('File 2 Contents');
      expect(tree.read('/dir/file2', 'utf-8')).toEqual('File 2 Contents');
      expect(tree.read('./dir/file2', 'utf-8')).toEqual('File 2 Contents');

      expect(tree.read('dir/file3', 'utf-8')).toEqual('File 3 Contents');
      expect(tree.read('/dir/file3', 'utf-8')).toEqual('File 3 Contents');
      expect(tree.read('./dir/file3', 'utf-8')).toEqual('File 3 Contents');

      tree.rename('dir/file1', 'dir/file-a');

      expect(tree.read('dir/file-a', 'utf-8')).toEqual('File 1 Contents');
      expect(tree.read('/dir/file-a', 'utf-8')).toEqual('File 1 Contents');
      expect(tree.read('./dir/file-a', 'utf-8')).toEqual('File 1 Contents');

      tree.rename('/dir/file2', '/dir/file-b');

      expect(tree.read('dir/file-b', 'utf-8')).toEqual('File 2 Contents');
      expect(tree.read('/dir/file-b', 'utf-8')).toEqual('File 2 Contents');
      expect(tree.read('./dir/file-b', 'utf-8')).toEqual('File 2 Contents');

      tree.rename('./dir/file3', './dir/file-c');

      expect(tree.read('dir/file-c', 'utf-8')).toEqual('File 3 Contents');
      expect(tree.read('/dir/file-c', 'utf-8')).toEqual('File 3 Contents');
      expect(tree.read('./dir/file-c', 'utf-8')).toEqual('File 3 Contents');
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
      } catch {}
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
      expect(tree.read('renamed-new-child-file.txt', 'utf-8')).toEqual(
        'new child content'
      );
      expect(tree.read('renamed-root-file.txt', 'utf-8')).toEqual(
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
        readFileSync(path.join(dir, 'renamed-new-child-file.txt'), 'utf-8')
      ).toEqual('new child content');
      expect(
        readFileSync(path.join(dir, 'renamed-root-file.txt'), 'utf-8')
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

    describe('children', () => {
      it('should return the list of children of a dir', () => {
        expect(tree.children('parent')).toEqual([
          'child',
          'parent-file-with-write-options.txt',
          'parent-file.txt',
        ]);
        expect(tree.children('parent/child')).toEqual(['child-file.txt']);
      });

      it('should add new children after writing new files', () => {
        tree.write('parent/child/child-file2.txt', 'new child content');
        tree.write('parent/new-child/new-child-file.txt', 'new child content');

        expect(tree.children('parent')).toEqual([
          'child',
          'parent-file-with-write-options.txt',
          'parent-file.txt',
          'new-child',
        ]);
        expect(tree.children('parent/child')).toEqual([
          'child-file.txt',
          'child-file2.txt',
        ]);
        expect(tree.children('parent/new-child')).toEqual([
          'new-child-file.txt',
        ]);
      });

      it('should return the list of children after renaming', () => {
        tree.rename(
          'parent/child/child-file.txt',
          'parent/child/renamed-child-file.txt'
        );

        expect(tree.children('parent/child')).toEqual([
          'renamed-child-file.txt',
        ]);

        tree.rename(
          'parent/child/renamed-child-file.txt',
          'parent/renamed-child/renamed-child-file.txt'
        );

        expect(tree.children('parent')).toEqual([
          'parent-file-with-write-options.txt',
          'parent-file.txt',
          'renamed-child',
        ]);
      });

      describe('at the root', () => {
        it('should return a list of children', () => {
          expect(tree.children('')).toEqual(['parent', 'root-file.txt']);
        });

        it('should add a child after writing a file', () => {
          tree.write('root-file2.txt', '');

          expect(tree.children('')).toEqual([
            'parent',
            'root-file.txt',
            'root-file2.txt',
          ]);
        });

        it('should remove a child after deleting a file', () => {
          tree.delete('parent/child/child-file.txt');
          tree.delete('parent/parent-file.txt');
          tree.delete('parent/parent-file-with-write-options.txt');

          expect(tree.children('')).not.toContain('parent');

          tree.delete('root-file.txt');

          expect(tree.children('')).not.toContain('root-file.txt');
        });
      });
    });

    it('should be able to rename dirs', () => {
      // not supported yet
    });

    describe('changePermissions', () => {
      it('should throw when the file is deleted', () => {
        const filePath = 'root-file.txt';
        tree.delete(filePath);

        expect(() => tree.changePermissions(filePath, '755')).toThrowError(
          `Cannot change permissions of deleted file ${filePath}.`
        );
      });

      it('should throw when the file does not exist', () => {
        const filePath = 'non-existent-file.txt';

        expect(() => tree.changePermissions(filePath, '755')).toThrowError(
          `Cannot change permissions of non-existing file ${filePath}.`
        );
      });

      it('should throw when the path provided is not a file', () => {
        const dirPath = 'parent';

        expect(() => tree.changePermissions(dirPath, '755')).toThrowError(
          `Cannot change permissions of non-file ${dirPath}.`
        );
      });

      it('should change files permissions', () => {
        const mode = '755';
        const changePermissionsFilePath = 'root-file.txt';
        const updatedContentFilePath = 'parent/parent-file.txt';
        const newFilePath = 'some-new-file.txt';
        tree.write(
          updatedContentFilePath,
          'file path with new updated content'
        );
        tree.write(newFilePath, 'new file created');

        tree.changePermissions(changePermissionsFilePath, mode);
        tree.changePermissions(updatedContentFilePath, mode);
        tree.changePermissions(newFilePath, mode);
        const changes = tree.listChanges();
        flushChanges(dir, changes);

        // unchanged file with permissions changed
        expect(s(changes)).toContainEqual({
          path: changePermissionsFilePath,
          type: 'UPDATE',
          content: 'root content',
          options: { mode },
        });
        expect(
          lstatSync(path.join(dir, changePermissionsFilePath)).mode &
            octal(mode)
        ).toEqual(octal(mode));
        // updated file content with permissions changed
        expect(s(changes)).toContainEqual({
          path: updatedContentFilePath,
          type: 'UPDATE',
          content: 'file path with new updated content',
          options: { mode },
        });
        expect(
          lstatSync(path.join(dir, updatedContentFilePath)).mode & octal(mode)
        ).toEqual(octal(mode));
        // new file with permissions changed
        expect(s(changes)).toContainEqual({
          path: newFilePath,
          type: 'CREATE',
          content: 'new file created',
          options: { mode },
        });
        expect(
          lstatSync(path.join(dir, newFilePath)).mode & octal(mode)
        ).toEqual(octal(mode));
      });
    });
  });

  function s(changes: FileChange[]) {
    return changes.map((f) => {
      if (f.content) (f as any).content = f.content.toString();
      return f;
    });
  }

  function octal(value: string | number): number {
    if (typeof value === 'string') return parseInt(value, 8);
    return value;
  }
});
