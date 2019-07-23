import { chain, Rule, Tree } from '@angular-devkit/schematics';

import { updateJsonInTree, insert } from '@nrwl/workspace';
import { formatFiles, updateWorkspaceInTree } from '@nrwl/workspace';

import * as ts from 'typescript';
import {
  getSourceNodes,
  ReplaceChange
} from '@nrwl/workspace/src/utils/ast-utils';

const setDefaults = updateWorkspaceInTree(json => {
  if (!json.schematics) {
    json.schematics = {};
  }
  if (!json.schematics['@nrwl/schematics:library']) {
    json.schematics['@nrwl/schematics:library'] = {};
  }
  if (!json.schematics['@nrwl/schematics:library'].framework) {
    json.schematics['@nrwl/schematics:library'].framework = 'angular';
  }
  return json;
});

const updateDependencies = updateJsonInTree('package.json', json => {
  json.devDependencies = json.devDependencies || {};
  if (json.devDependencies['jest']) {
    json.devDependencies['jest'] = '24.1.0';
  }
  if (json.devDependencies['@types/jest']) {
    json.devDependencies['@types/jest'] = '24.0.9';
  }
  if (json.devDependencies['jest-preset-angular']) {
    json.devDependencies['jest-preset-angular'] = '7.0.0';
  }
  return json;
});

function updateJestConfig(host: Tree) {
  if (host.exists('jest.config.js')) {
    const contents = host.read('jest.config.js').toString();
    const sourceFile = ts.createSourceFile(
      'jest.config.js',
      contents,
      ts.ScriptTarget.Latest
    );
    const changes: ReplaceChange[] = [];
    getSourceNodes(sourceFile).forEach(node => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isStringLiteral(node.initializer) &&
        node.initializer.text === 'jest-preset-angular/preprocessor.js'
      ) {
        changes.push(
          new ReplaceChange(
            'jest.config.js',
            node.initializer.getStart(sourceFile),
            node.initializer.getText(sourceFile),
            "'ts-jest'"
          )
        );
      }
    });
    insert(host, 'jest.config.js', changes);
  }
}

export default function(): Rule {
  return chain([
    setDefaults,
    updateDependencies,
    updateJestConfig,
    formatFiles()
  ]);
}
