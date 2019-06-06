import { readJsonInTree } from './ast-utils';
import { SchematicTestRunner } from '@angular-devkit/schematics/testing';
import { join } from 'path';
import { Tree } from '@angular-devkit/schematics';
import { serializeJson } from './fileutils';

describe('readJsonInTree', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = Tree.empty();
  });
  it('should read JSON from the tree', () => {
    tree.create(
      'data.json',
      serializeJson({
        data: 'data'
      })
    );
    expect(readJsonInTree(tree, 'data.json')).toEqual({
      data: 'data'
    });
  });

  it('should handle json files with comments', () => {
    tree.create(
      'data.json',
      `{
      // data: 'data'
      }`
    );
    expect(readJsonInTree(tree, 'data.json')).toEqual({});
  });

  it('should throw an error if the file does not exist', () => {
    expect(() => readJsonInTree(tree, 'data.json')).toThrow(
      'Cannot find data.json'
    );
  });

  it('should throw an error if the file cannot be parsed', () => {
    tree.create('data.json', `{ data: 'data'`);
    expect(() => readJsonInTree(tree, 'data.json')).toThrow(
      'Cannot parse data.json: Unexpected token d in JSON at position 2'
    );
  });
});
