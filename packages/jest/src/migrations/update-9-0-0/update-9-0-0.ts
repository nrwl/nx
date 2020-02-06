import {
  chain,
  Rule,
  SchematicContext,
  Tree
} from '@angular-devkit/schematics';
import {
  formatFiles,
  insert,
  readWorkspace,
  updatePackagesInPackageJson
} from '@nrwl/workspace';
import * as ts from 'typescript';
import * as path from 'path';
import {
  Change,
  getSourceNodes,
  InsertChange,
  readJsonInTree,
  ReplaceChange,
  RemoveChange
} from '@nrwl/workspace/src/utils/ast-utils';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { updateWorkspace } from '@nrwl/workspace/src/utils/workspace';

export default function update(): Rule {
  return chain([
    displayInformation,
    updatePackagesInPackageJson(
      path.join(__dirname, '../../../', 'migrations.json'),
      '9.0.0'
    ),
    addPassWithNoTestsToWorkspace,
    updateJestConfigs,
    removePassWithNoTestsFromJestConfig,
    formatFiles()
  ]);
}

const addPassWithNoTestsToWorkspace = updateWorkspace(workspace => {
  workspace.projects.forEach(project => {
    project.targets.forEach(target => {
      if (
        target.builder === '@nrwl/jest:jest' &&
        target.options &&
        target.options.passWithNoTests === undefined
      ) {
        target.options.passWithNoTests = true;
      }
    });
  });
});

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

function updateJestConfigs(host: Tree) {
  const config = readJsonInTree(host, 'package.json');

  if (config.devDependencies && config.devDependencies['jest-preset-angular']) {
    const workspaceConfig = readWorkspace(host);
    const jestConfigsToUpdate = [];

    Object.values<any>(workspaceConfig.projects).forEach(project => {
      if (!project.architect) {
        return;
      }

      Object.values<any>(project.architect).forEach(target => {
        if (target.builder !== '@nrwl/jest:jest') {
          return;
        }

        if (target.options.jestConfig) {
          jestConfigsToUpdate.push(target.options.jestConfig);
        }

        if (target.configurations) {
          Object.values<any>(target.configurations).forEach(config => {
            if (config.jestConfig) {
              jestConfigsToUpdate.push(config.jestConfig);
            }
          });
        }
      });
    });

    jestConfigsToUpdate.forEach(configPath => {
      if (host.exists(configPath)) {
        const contents = host.read(configPath).toString();
        const sourceFile = ts.createSourceFile(
          configPath,
          contents,
          ts.ScriptTarget.Latest
        );

        const changes: Change[] = [];

        getSourceNodes(sourceFile).forEach(node => {
          if (node && ts.isStringLiteral(node)) {
            const nodeText = node.text;

            if (
              nodeText === 'jest-preset-angular/AngularSnapshotSerializer.js'
            ) {
              // add new serializer from v8 of jest-preset-angular
              changes.push(
                new InsertChange(
                  configPath,
                  node.getStart(sourceFile),
                  `'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js',\n`
                )
              );

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

function removePassWithNoTestsFromJestConfig(host: Tree) {
  if (host.exists('jest.config.js')) {
    const contents = host.read('jest.config.js').toString();
    const sourceFile = ts.createSourceFile(
      'jest.config.js',
      contents,
      ts.ScriptTarget.Latest
    );
    const changes: RemoveChange[] = [];
    const sourceNodes = getSourceNodes(sourceFile);
    sourceNodes.forEach((node, index) => {
      if (
        ts.isPropertyAssignment(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === 'passWithNoTests'
      ) {
        const expectedCommaNode = sourceNodes[index + 4];
        const isFollowedByComma =
          expectedCommaNode.kind === ts.SyntaxKind.CommaToken;
        changes.push(
          new RemoveChange(
            'jest.config.js',
            node.getStart(sourceFile),
            isFollowedByComma
              ? node.getFullText(sourceFile)
              : node.getText(sourceFile)
          )
        );
      }
    });
    insert(host, 'jest.config.js', changes);
  }
}
