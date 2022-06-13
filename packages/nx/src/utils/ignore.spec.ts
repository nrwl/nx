import { vol } from 'memfs';
import { createTree } from '../generators/testing-utils/create-tree';
import { Tree } from '../generators/tree';
import {
  createCombinedIgnore,
  createIgnore,
  createIgnoreFromTree,
} from './ignore';
import { stripIndents } from './strip-indents';

jest.mock('fs', () => require('memfs').fs);

describe('createIgnore', () => {
  afterEach(() => {
    vol.reset();
  });

  it('should combine all ignore files in tree', () => {
    vol.fromJSON(
      {
        '.ignore': 'a',
        'b/.ignore': 'c',
      },
      '/root'
    );

    const ignore = createIgnore('/root', ['.ignore']);
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
