import type { ProjectGraph, ProjectGraphProjectNode } from '@nx/devkit';
import { findUnmatchedProjectPatterns } from './project-patterns';

function project(
  name: string,
  root: string,
  tags: string[]
): ProjectGraphProjectNode {
  return { name, type: 'lib', data: { root, tags, targets: {} } };
}

const projectGraph: ProjectGraph = {
  nodes: Object.fromEntries(
    [
      project('@acme/shop-ui', 'libs/shop-ui', ['ui']),
      project('shop-e2e', 'apps/shop-e2e', ['e2e']),
      project('shop-api', 'apps/shop-api', []),
    ].map((node) => [node.name, node])
  ),
  dependencies: {},
};

describe('findUnmatchedProjectPatterns', () => {
  it.each([
    'shop-e2e',
    '@acme/shop-ui',
    'name:shop-api',
    'shop-*',
    'tag:ui',
    'directory:apps/*',
    'apps/shop-api',
  ])('does not report %s, which selects a project', (pattern) => {
    expect(findUnmatchedProjectPatterns([pattern], projectGraph)).toEqual(
      new Map()
    );
  });

  it.each([
    ['shop-ui', '@acme/shop-ui'],
    ['name:Shop-UI', '@acme/shop-ui'],
    ['shop-e2ee', 'shop-e2e'],
    ['name:shop-apii', 'shop-api'],
    ['billing', undefined],
    ['tag:uii', undefined],
    ['directory:libs/shop-uii', undefined],
  ])('reports %s and suggests %s', (pattern, suggestion) => {
    expect(findUnmatchedProjectPatterns([pattern], projectGraph)).toEqual(
      new Map([[pattern, suggestion]])
    );
  });
});
