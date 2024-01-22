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
});
