import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createTree } from '../generators/testing-utils/create-tree';
import { Tree } from '../generators/tree';
import {
  createCombinedIgnore,
  createIgnoreFromFS,
  createIgnoreFromTree,
} from './ignore';
import { stripIndents } from './strip-indents';

describe('createIgnoreFromFS', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nx-createIgnoreFromFS-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });

  it('should combine all ignore files in tree', () => {
    fs.writeFileSync(path.join(tmpDir, '.ignore'), 'a');
    fs.mkdirSync(path.join(tmpDir, 'b'));
    fs.writeFileSync(path.join(tmpDir, 'b/.ignore'), 'c');
    const ignore = createIgnoreFromFS(tmpDir, ['.ignore']);
    expect(ignore.ignores('a')).toBe(true);
    expect(ignore.ignores('b/c')).toBe(true);
  });
});

describe('createIgnoreFromTree', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should combine all ignore files in tree', () => {
    tree.write('.ignore', 'a');
    tree.write('b/.ignore', 'c');
    const ignore = createIgnoreFromTree(tree, ['.ignore']);
    expect(ignore.ignores('a')).toBe(true);
    expect(ignore.ignores('b/c')).toBe(true);
  });
});

describe('createCombinedIgnore', () => {
  it('should support ignore file at root', () => {
    const ignore = createCombinedIgnore([{ path: '.ignore', content: 'b' }]);
    expect(ignore.ignores('b')).toBe(true);
    expect(ignore.ignores('c')).toBe(false);
  });

  it('should support nested ignore file', () => {
    const ignore = createCombinedIgnore([{ path: 'a/.ignore', content: 'b' }]);
    expect(ignore.ignores('a/b')).toBe(true);
    expect(ignore.ignores('a/c')).toBe(false);
    expect(ignore.ignores('d')).toBe(false);
  });

  it('should support ignore files at multiple levels', () => {
    const ignore = createCombinedIgnore([
      { path: '.ignore', content: 'a' },
      { path: 'b/.ignore', content: 'c' },
    ]);
    expect(ignore.ignores('a')).toBe(true);
    expect(ignore.ignores('a/a')).toBe(true);
    expect(ignore.ignores('a/c')).toBe(true);
    expect(ignore.ignores('c')).toBe(false);
    expect(ignore.ignores('b/d')).toBe(false);
  });

  it('should support negating rules', () => {
    const ignore = createCombinedIgnore([
      {
        path: '.ignore',
        content: stripIndents`
            a*
            !a
      `,
      },
    ]);
    expect(ignore.ignores('aa')).toBe(true);
    expect(ignore.ignores('a')).toBe(false);
  });
});
