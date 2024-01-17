import { readJson, writeJson, type Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateVsCodeRecommendedExtensions } from './update-vscode-recommended-extensions';

describe('updateVsCodeRecommendedExtensions', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should add the jest extension to the recommended property', () => {
    writeJson(tree, '.vscode/extensions.json', {
      recommendations: [
        'nrwl.angular-console',
        'angular.ng-template',
        'dbaeumer.vscode-eslint',
        'esbenp.prettier-vscode',
      ],
    });

    updateVsCodeRecommendedExtensions(tree);

    const extensionsJson = readJson(tree, '.vscode/extensions.json');
    expect(extensionsJson).toMatchInlineSnapshot(`
      {
        "recommendations": [
          "nrwl.angular-console",
          "angular.ng-template",
          "dbaeumer.vscode-eslint",
          "esbenp.prettier-vscode",
          "firsttris.vscode-jest-runner",
        ],
      }
    `);
  });
});
