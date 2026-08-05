import { TempFs } from '../../internal-testing-utils/temp-fs';
import { FsTree, Tree } from '../tree';
import { glob } from './glob';

describe('glob', () => {
  let fs: TempFs;
  let tree: Tree;

  beforeEach(() => {
    fs = new TempFs('glob', true);
    tree = new FsTree(fs.tempDir, false);
  });

  afterEach(() => {
    fs.cleanup();
  });

  it('should find files on disk', async () => {
    fs.writeFile('1.txt', '1');
    fs.writeFile('2.txt', '2');
    fs.writeFile('3.txt', '3');
    fs.writeFile('4.md', '4');

    const results = glob(tree, ['*.txt']).sort();

    expect(results).toMatchInlineSnapshot(`
      [
        "1.txt",
        "2.txt",
        "3.txt",
      ]
    `);
  });

  it('should add files from tree', async () => {
    fs.writeFile('1.txt', '1');
    fs.writeFile('2.txt', '2');
    tree.write('3.txt', '3');
    fs.writeFile('4.md', '4');

    const withTree = glob(tree, ['**/*.txt']).sort();

    expect(withTree).toMatchInlineSnapshot(`
      [
        "1.txt",
        "2.txt",
        "3.txt",
      ]
    `);
  });

  it('should hide files deleted on tree', async () => {
    fs.writeFile('1.txt', '1');
    fs.writeFile('2.txt', '2');
    fs.writeFile('3.txt', '3');
    tree.delete('3.txt');
    fs.writeFile('4.md', '4');

    const withTree = glob(tree, ['*.txt']).sort();

    expect(withTree).toMatchInlineSnapshot(`
      [
        "1.txt",
        "2.txt",
      ]
    `);
  });

  it('should not match tree files that only satisfy a negated pattern', async () => {
    tree.write('packages/a/package.json', '{}');
    tree.write('packages/excluded/package.json', '{}');
    tree.write('tools/package.json', '{}');

    const withTree = glob(tree, [
      'packages/*/package.json',
      '!packages/excluded/package.json',
    ]).sort();

    expect(withTree).toMatchInlineSnapshot(`
      [
        "packages/a/package.json",
      ]
    `);
  });

  it('should match root-level tree files against a combined brace pattern', async () => {
    tree.write('package.json', '{}');
    tree.write('libs/a/package.json', '{}');
    tree.write('libs/a/other.md', '');

    const withTree = glob(tree, ['{**/package.json,**/project.json}']).sort();

    expect(withTree).toEqual(['libs/a/package.json', 'package.json']);
  });

  it('should hide a deleted root-level file for a combined brace pattern', async () => {
    fs.createFilesSync({
      'package.json': '{}',
      'libs/a/package.json': '{}',
    });
    tree.delete('package.json');

    const withTree = glob(tree, ['{**/package.json,**/project.json}']).sort();

    expect(withTree).toEqual(['libs/a/package.json']);
  });

  it('should treat a list of only negations as everything not excluded', async () => {
    tree.write('keep.txt', '1');
    tree.write('drop.txt', '2');

    const withTree = glob(tree, ['!drop.txt']).sort();

    expect(withTree).toEqual(['keep.txt']);
  });

  it('should treat a leading "!(" as an extglob, not a negation', async () => {
    tree.write('tools/a/package.json', '{}');
    tree.write('libs/a/package.json', '{}');

    const withTree = glob(tree, ['!(tools)/**/package.json']).sort();

    expect(withTree).toEqual(['libs/a/package.json']);
  });

  it('should name the offending entry when a pattern is empty', async () => {
    expect(() => glob(tree, ['**/*.ts', ''])).toThrow(
      'Invalid glob pattern: ""'
    );
  });
});
