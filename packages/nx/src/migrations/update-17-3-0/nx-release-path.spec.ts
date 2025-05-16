import { createTreeWithEmptyWorkspace } from '../../generators/testing-utils/create-tree-with-empty-workspace';
import { Tree } from '../../generators/tree';
import { readJson, writeJson } from '../../generators/utils/json';
import nxReleasePath from './nx-release-path';

describe('nxReleasePath', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should update changelog renderer references', () => {
    writeJson(tree, 'nx.json', {
      $schema: './node_modules/nx/schemas/nx-schema.json',
      release: {
        changelog: {
          git: {
            commit: true,
            tag: true,
          },
          workspaceChangelog: {
            createRelease: 'github',
            renderer: 'nx/changelog-renderer',
          },
          projectChangelogs: {
            renderer: 'nx/changelog-renderer',
          },
        },
        version: {
          generatorOptions: {
            currentVersionResolver: 'git-tag',
            specifierSource: 'conventional-commits',
          },
        },
      },
    });

    tree.write(
      'some-script.js',
      `
      import { releaseVersion } from 'nx/src/command-line/release';
      const { releaseChangelog } = require("nx/src/command-line/release");
    `
    );

    // these should not be updated, only the formalized programmatic API
    tree.write(
      'some-other-file.ts',
      `
      import { foo } from 'nx/src/command-line/release/nested/thing';
      const { releaseChangelog } = require("nx/src/command-line/release/another/nested/thing");
    `
    );

    nxReleasePath(tree);

    // intentionally unchanged
    expect(tree.read('some-other-file.ts').toString('utf-8'))
      .toMatchInlineSnapshot(`
      "
            import { foo } from 'nx/src/command-line/release/nested/thing';
            const { releaseChangelog } = require("nx/src/command-line/release/another/nested/thing");
          "
    `);

    // programmatic API should be updated to nx/release
    expect(tree.read('some-script.js').toString('utf-8'))
      .toMatchInlineSnapshot(`
      "
            import { releaseVersion } from 'nx/release';
            const { releaseChangelog } = require("nx/release");
          "
    `);

    // nx/changelog-renderer references should be updated to nx/release/changelog-renderer
    expect(readJson(tree, 'nx.json')).toMatchInlineSnapshot(`
      {
        "$schema": "./node_modules/nx/schemas/nx-schema.json",
        "release": {
          "changelog": {
            "git": {
              "commit": true,
              "tag": true,
            },
            "projectChangelogs": {
              "renderer": "nx/release/changelog-renderer",
            },
            "workspaceChangelog": {
              "createRelease": "github",
              "renderer": "nx/release/changelog-renderer",
            },
          },
          "version": {
            "generatorOptions": {
              "currentVersionResolver": "git-tag",
              "specifierSource": "conventional-commits",
            },
          },
        },
      }
    `);
  });
});
