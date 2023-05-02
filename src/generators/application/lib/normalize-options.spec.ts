import { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { normalizeOptions } from './normalize-options';

describe('normalizeOptions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should set { rootProject: true } when --rootProject=true is passed', () => {
    expect(
      normalizeOptions(tree, {
        name: 'demo',
        style: 'css',
        rootProject: true,
      }).rootProject
    ).toBeTruthy();
  });

  it('should set { rootProject: false } when --rootProject=undefined is passed', () => {
    expect(
      normalizeOptions(tree, {
        name: 'demo',
        style: 'css',
      }).rootProject
    ).toBeFalsy();
  });

  it('should set { rootProject: false } when --rootProject=false is passed', () => {
    expect(
      normalizeOptions(tree, {
        name: 'demo',
        style: 'css',
        rootProject: false,
      }).rootProject
    ).toBeFalsy();
  });

  it('should set { rootProject: false } when --monorepo=true and --rootProject=true is passed', () => {
    expect(
      normalizeOptions(tree, {
        name: 'demo',
        style: 'css',
        monorepo: true,
        rootProject: true,
      }).rootProject
    ).toBeFalsy();
  });
});
