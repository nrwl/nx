import {
  Tree,
  Rule,
  chain,
  SchematicContext
} from '@angular-devkit/schematics';
import { readWorkspace, insert, formatFiles } from '@nrwl/workspace';
import * as ts from 'typescript';
import {
  ReplaceChange,
  updateJsonInTree,
  readJsonInTree,
  getSourceNodes
} from '@nrwl/workspace/src/utils/ast-utils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

export default function update(): Rule {
  return chain([
    displayInformation,
    updateDependencies,
    updateJestConfigs,
    formatFiles()
  ]);
}

function displayInformation(host: Tree, context: SchematicContext) {
  const config = readJsonInTree(host, 'package.json');
  if (config.devDependencies && config.devDependencies['jest-preset-angular']) {
    context.logger.info(stripIndents`
    \`jest-preset-angular\` 8.0.0 has restructured folders, introducing breaking changes to 
    jest.config.js files.
    
    We are updating snapshotSerializers in each Angular project to include appropriate paths.
    
    See: https://github.com/thymikee/jest-preset-angular/releases/tag/v8.0.0
  `);
  }
}

const updateDependencies = updateJsonInTree('package.json', json => {
  json.devDependencies = json.devDependencies || {};

  if (json.devDependencies['jest-preset-angular']) {
    json.devDependencies['jest-preset-angular'] = '8.0.0';
  }

  return json;
});

function updateJestConfigs(host: Tree) {
  const config = readJsonInTree(host, 'package.json');

  if (config.devDependencies && config.devDependencies['jest-preset-angular']) {
    const workspaceConfig = readWorkspace(host);
    const jestConfigsToUpdate = [];

    Object.keys(workspaceConfig.projects).forEach(name => {
      const project = workspaceConfig.projects[name];
      if (
        project.architect &&
        project.architect.test &&
        project.architect.test.builder === '@nrwl/jest:jest' &&
        project.architect.test.options &&
        project.architect.test.options.jestConfig ===
          project.root + 'jest.config.js'
      ) {
        jestConfigsToUpdate.push(project.root + 'jest.config.js');
      }
    });

    jestConfigsToUpdate.forEach(configPath => {
      if (host.exists(configPath)) {
        const contents = host.read(configPath).toString();
        const sourceFile = ts.createSourceFile(
          configPath,
          contents,
          ts.ScriptTarget.Latest
        );

        const changes: ReplaceChange[] = [];

        getSourceNodes(sourceFile).forEach(node => {
          if (node && ts.isStringLiteral(node)) {
            const nodeText = node.text;
            if (
              nodeText === 'jest-preset-angular/AngularSnapshotSerializer.js'
            ) {
              changes.push(
                new ReplaceChange(
                  configPath,
                  node.getStart(sourceFile) + 1,
                  nodeText,
                  'jest-preset-angular/build/AngularSnapshotSerializer.js'
                )
              );
            }

            if (nodeText === 'jest-preset-angular/HTMLCommentSerializer.js') {
              changes.push(
                new ReplaceChange(
                  configPath,
                  node.getStart(sourceFile) + 1,
                  nodeText,
                  'jest-preset-angular/build/HTMLCommentSerializer.js'
                )
              );
            }
          }
        });

        insert(
          host,
          configPath,
          changes.sort((a, b) => (a.order > b.order ? -1 : 1))
        );
      }
    });
  }
}
