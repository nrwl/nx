import { chain, Rule, Tree } from '@angular-devkit/schematics';
import {
  formatFiles,
  insert,
  updateJsonInTree,
  updatePackagesInPackageJson,
} from '@nrwl/workspace';
import { ReplaceChange } from '@nrwl/workspace/src/utils/ast-utils';
import ignore from 'ignore';
import { join, relative } from 'path';
import {
  createSourceFile,
  isDecorator,
  isImportClause,
  isImportDeclaration,
  isStringLiteral,
  ScriptTarget,
} from 'typescript';

export default function update(): Rule {
  return chain([
    updatePackagesInPackageJson(
      join(__dirname, '../../../', 'migrations.json'),
      '9.4.0'
    ),
    formatFiles(),
    updateImports,
    removeObsoletePackages,
  ]);
}

function removeObsoletePackages() {
  return updateJsonInTree('package.json', (json) => {
    if (json.dependencies && json.dependencies['type-graphql']) {
      delete json.dependencies['type-graphql'];
    }
    return json;
  });
}

function updateImports(host: Tree) {
  let ig = ignore();

  if (host.exists('.gitignore')) {
    ig = ig.add(host.read('.gitignore').toString());
  }

  host.visit((path) => {
    if (ig.ignores(relative('/', path)) || !/\.ts?$/.test(path)) {
      return;
    }

    const sourceFile = createSourceFile(
      path,
      host.read(path).toString(),
      ScriptTarget.Latest,
      true
    );
    const changes = [];
    sourceFile.statements.forEach((statement) => {
      if (
        isImportDeclaration(statement) &&
        isStringLiteral(statement.moduleSpecifier)
      ) {
        const nodeText = statement.moduleSpecifier.getText(sourceFile);
        const modulePath = statement.moduleSpecifier
          .getText(sourceFile)
          .substr(1, nodeText.length - 2);
        if (modulePath === 'type-graphql') {
          changes.push(
            new ReplaceChange(
              path,
              statement.moduleSpecifier.getStart(sourceFile),
              nodeText,
              `'@nestjs/graphql'`
            )
          );
        }
      }
    });
    insert(host, path, changes);
  });
}
