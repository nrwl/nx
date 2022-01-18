import * as ts from 'typescript';
import {
  chain,
  noop,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import {
  formatFiles,
  insert,
  readJsonInTree,
  updateJsonInTree,
  updatePackageJsonDependencies,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import * as path from 'path';
import { relative } from 'path';
import { ReplaceChange } from '@nrwl/workspace/src/utils/ast-utils';

const ignore = require('ignore');

export default function update(): Rule {
  return chain([
    displayInformation,
    updateDependencies,
    updateImports,
    updatePackagesInPackageJson(
      path.join(__dirname, '../../../', 'migrations.json'),
      '8.9.0'
    ),
    formatFiles(),
  ]);
}

function displayInformation(host: Tree, context: SchematicContext) {
  const packageJson = readJsonInTree(host, '/package.json');
  if (packageJson.dependencies['redux-starter-kit']) {
    context.logger.info(stripIndents`
    Redux Starter Kit been renamed to Redux Toolkit as of version 1.0.
    
    We are replacing your \`redux-starter-kit\` imports with \`@reduxjs/toolkit\`.
    
    See: https://github.com/reduxjs/redux-toolkit/releases/tag/v1.0.4
  `);
  }
}

function updateDependencies(host: Tree) {
  const packageJson = readJsonInTree(host, '/package.json');
  if (!packageJson.dependencies['redux-starter-kit']) {
    return noop();
  }

  const removeOld = updateJsonInTree(
    'package.json',
    (json, context: SchematicContext) => {
      json.dependencies = json.dependencies || {};
      delete json.dependencies['redux-starter-kit'];
      context.logger.info(`Removing \`redux-starter-kit\` as a dependency`);
      return json;
    }
  );

  const addNew = updatePackageJsonDependencies(
    { '@reduxjs/toolkit': '1.0.4' },
    {}
  );

  return chain([removeOld, addNew]);
}

function updateImports(host: Tree) {
  let ig = ignore();

  if (host.exists('.gitignore')) {
    ig = ig.add(host.read('.gitignore').toString());
  }

  host.visit((path) => {
    if (ig.ignores(relative('/', path)) || !/\.tsx?$/.test(path)) {
      return;
    }

    const sourceFile = ts.createSourceFile(
      path,
      host.read(path).toString(),
      ts.ScriptTarget.Latest,
      true
    );
    const changes = [];
    sourceFile.statements.forEach((statement) => {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier)
      ) {
        const nodeText = statement.moduleSpecifier.getText(sourceFile);
        const modulePath = statement.moduleSpecifier
          .getText(sourceFile)
          .substring(1, nodeText.length - 2);
        if (modulePath === 'redux-starter-kit') {
          changes.push(
            new ReplaceChange(
              path,
              statement.moduleSpecifier.getStart(sourceFile),
              nodeText,
              `'@reduxjs/toolkit'`
            )
          );
        }
      }
    });
    insert(host, path, changes);
  });
}
