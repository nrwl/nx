import { chain, Rule, Tree } from '@angular-devkit/schematics';

import * as ts from 'typescript';

import {
  addDepsToPackageJson,
  addUpdateTask,
  formatFiles,
  insert,
  readJsonInTree,
  updateJsonInTree,
  updateWorkspaceInTree
} from '@nrwl/workspace';
import {
  getSourceNodes,
  ReplaceChange
} from '@nrwl/workspace/src/utils/ast-utils';

const addExtensionRecommendations = updateJsonInTree(
  '.vscode/extensions.json',
  (json: { recommendations?: string[] }) => {
    json.recommendations = json.recommendations || [];
    [
      'nrwl.angular-console',
      'angular.ng-template',
      'esbenp.prettier-vscode'
    ].forEach(extension => {
      if (!json.recommendations.includes(extension)) {
        json.recommendations.push(extension);
      }
    });

    return json;
  }
);

function addItemToImport(
  path: string,
  sourceFile: ts.SourceFile,
  printer: ts.Printer,
  importStatement: ts.ImportDeclaration,
  symbol: string
) {
  const newImport = ts.createImportDeclaration(
    importStatement.decorators,
    importStatement.modifiers,
    ts.createImportClause(
      importStatement.importClause.name,
      ts.createNamedImports([
        ...(importStatement.importClause.namedBindings as ts.NamedImports)
          .elements,
        ts.createImportSpecifier(undefined, ts.createIdentifier(symbol))
      ])
    ),
    importStatement.moduleSpecifier
  );
  return new ReplaceChange(
    path,
    importStatement.getStart(sourceFile),
    importStatement.getText(sourceFile),
    printer.printNode(ts.EmitHint.Unspecified, newImport, sourceFile)
  );
}

function isEffectDecorator(decorator: ts.Decorator) {
  return (
    ts.isCallExpression(decorator.expression) &&
    ts.isIdentifier(decorator.expression.expression) &&
    decorator.expression.expression.text === 'Effect'
  );
}

function getImport(sourceFile: ts.SourceFile, path: string, symbol: string) {
  return sourceFile.statements
    .filter(ts.isImportDeclaration)
    .filter(statement =>
      statement.moduleSpecifier.getText(sourceFile).includes(path)
    )
    .find(statement => {
      if (!ts.isNamedImports(statement.importClause.namedBindings)) {
        return false;
      }

      return statement.importClause.namedBindings.elements.some(
        element => element.getText(sourceFile) === symbol
      );
    });
}

function updateOfTypeCode(path: string, sourceFile: ts.SourceFile) {
  const effectsImport = getImport(sourceFile, '@ngrx/effects', 'Effect');
  if (!effectsImport) {
    return [];
  }

  const effects: ts.PropertyDeclaration[] = [];
  const changes: ReplaceChange[] = [];

  const printer = ts.createPrinter();

  sourceFile.statements
    .filter(ts.isClassDeclaration)
    .map(clazz =>
      clazz.members
        .filter(ts.isPropertyDeclaration)
        .filter(
          member =>
            member.decorators && member.decorators.some(isEffectDecorator)
        )
    )
    .forEach(properties => {
      effects.push(...properties);
    });

  effects.forEach(effect => {
    if (
      ts.isCallExpression(effect.initializer) &&
      ts.isPropertyAccessExpression(effect.initializer.expression) &&
      effect.initializer.expression.name.text === 'pipe' &&
      ts.isCallExpression(effect.initializer.expression.expression) &&
      ts.isPropertyAccessExpression(
        effect.initializer.expression.expression.expression
      ) &&
      effect.initializer.expression.expression.expression.name.text === 'ofType'
    ) {
      const originalText = effect.initializer.getText(sourceFile);

      const ofTypeExpression = ts.createCall(
        ts.createIdentifier('ofType'),
        effect.initializer.expression.expression.typeArguments,
        effect.initializer.expression.expression.arguments
      );

      const node = ts.createCall(
        ts.createPropertyAccess(
          effect.initializer.expression.expression.expression.expression,
          'pipe'
        ),
        effect.initializer.typeArguments,
        ts.createNodeArray([
          ofTypeExpression,
          ...(effect.initializer as ts.CallExpression).arguments
        ])
      );
      const newEffect = printer.printNode(
        ts.EmitHint.Expression,
        node,
        sourceFile
      );

      const change = new ReplaceChange(
        path,
        effect.initializer.getStart(sourceFile),
        originalText,
        newEffect
      );
      changes.push(change);
    }
  });

  if (changes.length > 0) {
    changes.unshift(
      addItemToImport(path, sourceFile, printer, effectsImport, 'ofType')
    );
  }

  return changes;
}

function getConstructor(
  classDeclaration: ts.ClassDeclaration
): ts.ConstructorDeclaration {
  return classDeclaration.members.find(ts.isConstructorDeclaration);
}

function getStoreProperty(
  sourceFile: ts.SourceFile,
  constructor: ts.ConstructorDeclaration
): string {
  const storeParameter = constructor.parameters.find(
    parameter =>
      parameter.type && parameter.type.getText(sourceFile).includes('Store')
  );
  return storeParameter ? storeParameter.name.getText(sourceFile) : null;
}

function updateSelectorCode(path: string, sourceFile: ts.SourceFile) {
  const storeImport = getImport(sourceFile, '@ngrx/store', 'Store');
  if (!storeImport) {
    return [];
  }
  const changes: ReplaceChange[] = [];

  const printer = ts.createPrinter();

  sourceFile.statements
    .filter(ts.isClassDeclaration)
    .forEach(classDeclaration => {
      const constructor = getConstructor(classDeclaration);
      if (!constructor) {
        return;
      }

      const storeProperty = getStoreProperty(sourceFile, constructor);
      getSourceNodes(sourceFile).forEach(node => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isPropertyAccessExpression(node.expression.expression) &&
          ts.isIdentifier(node.expression.name) &&
          ts.isIdentifier(node.expression.expression.name) &&
          node.expression.name.getText(sourceFile) === 'select' &&
          node.expression.expression.name.getText(sourceFile) ===
            storeProperty &&
          node.expression.expression.expression.kind ===
            ts.SyntaxKind.ThisKeyword
        ) {
          const newExpression = ts.createCall(
            ts.createPropertyAccess(
              ts.createPropertyAccess(
                ts.createIdentifier('this'),
                ts.createIdentifier(storeProperty)
              ),
              ts.createIdentifier('pipe')
            ),
            [],
            [
              ts.createCall(
                ts.createIdentifier('select'),
                node.typeArguments,
                node.arguments
              )
            ]
          );
          const newNode = printer.printNode(
            ts.EmitHint.Expression,
            newExpression,
            sourceFile
          );
          changes.push(
            new ReplaceChange(
              path,
              node.getStart(sourceFile),
              node.getText(sourceFile),
              newNode
            )
          );
        }
      });
    });

  if (changes.length > 0) {
    changes.unshift(
      addItemToImport(path, sourceFile, printer, storeImport, 'select')
    );
  }

  return changes;
}

function migrateNgrx(host: Tree) {
  const ngrxVersion = readJsonInTree(host, 'package.json').dependencies[
    '@ngrx/store'
  ];
  if (
    ngrxVersion &&
    !(
      ngrxVersion.startsWith('6.') ||
      ngrxVersion.startsWith('~6.') ||
      ngrxVersion.startsWith('^6.')
    )
  ) {
    return host;
  }

  host.visit(path => {
    if (!path.endsWith('.ts')) {
      return;
    }

    let sourceFile = ts.createSourceFile(
      path,
      host.read(path).toString(),
      ts.ScriptTarget.Latest
    );

    if (sourceFile.isDeclarationFile) {
      return;
    }

    insert(host, path, updateOfTypeCode(path, sourceFile));

    sourceFile = ts.createSourceFile(
      path,
      host.read(path).toString(),
      ts.ScriptTarget.Latest
    );

    insert(host, path, updateSelectorCode(path, sourceFile));

    sourceFile = ts.createSourceFile(
      path,
      host.read(path).toString(),
      ts.ScriptTarget.Latest
    );

    insert(host, path, cleanUpDoublePipes(path, sourceFile));
  });
}

function cleanUpDoublePipes(
  path: string,
  sourceFile: ts.SourceFile
): ReplaceChange[] {
  const changes: ReplaceChange[] = [];

  const printer = ts.createPrinter();

  getSourceNodes(sourceFile).forEach(node => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isCallExpression(node.expression.expression) &&
      ts.isPropertyAccessExpression(node.expression.expression.expression) &&
      node.expression.name.text === 'pipe' &&
      node.expression.expression.expression.name.text === 'pipe'
    ) {
      const singlePipe = ts.createCall(
        node.expression.expression.expression,
        node.typeArguments,
        [...node.expression.expression.arguments, ...node.arguments]
      );
      changes.push(
        new ReplaceChange(
          path,
          node.getStart(sourceFile),
          node.getText(sourceFile),
          printer.printNode(ts.EmitHint.Expression, singlePipe, sourceFile)
        )
      );
    }
  });

  return changes;
}

const updateNgrx = updateJsonInTree('package.json', json => {
  json.devDependencies = json.devDependencies || {};
  json.dependencies = json.dependencies || {};

  json.dependencies = {
    ...json.dependencies,
    '@ngrx/effects': '7.2.0',
    '@ngrx/router-store': '7.2.0',
    '@ngrx/store': '7.2.0'
  };

  json.devDependencies = {
    ...json.devDependencies,
    '@ngrx/schematics': '7.2.0',
    '@ngrx/store-devtools': '7.2.0'
  };
  return json;
});

const addDotEnv = updateJsonInTree('package.json', json => {
  json.devDependencies = json.devDependencies || {};
  json.devDependencies = {
    ...json.devDependencies,
    dotenv: '6.2.0'
  };
  return json;
});

const setDefaults = updateWorkspaceInTree(json => {
  if (!json.schematics) {
    json.schematics = {};
  }
  if (!json.schematics['@nrwl/schematics:library']) {
    json.schematics['@nrwl/schematics:library'] = {};
  }
  if (!json.schematics['@nrwl/schematics:library'].unitTestRunner) {
    json.schematics['@nrwl/schematics:library'].unitTestRunner = 'karma';
  }
  if (!json.schematics['@nrwl/schematics:application']) {
    json.schematics['@nrwl/schematics:application'] = {};
  }
  if (!json.schematics['@nrwl/schematics:application'].unitTestRunner) {
    json.schematics['@nrwl/schematics:application'].unitTestRunner = 'karma';
  }
  if (!json.schematics['@nrwl/schematics:application'].e2eTestRunner) {
    json.schematics['@nrwl/schematics:application'].e2eTestRunner =
      'protractor';
  }
  if (!json.schematics['@nrwl/schematics:node-application']) {
    json.schematics['@nrwl/schematics:node-application'] = {};
  }
  if (!json.schematics['@nrwl/schematics:node-application'].framework) {
    json.schematics['@nrwl/schematics:node-application'].framework = 'express';
  }
  return json;
});

const updateAngularCLI = chain([
  addUpdateTask('@angular/cli', '7.3.1'),
  addDepsToPackageJson(
    {},
    {
      '@angular-devkit/build-angular': '~0.13.1'
    }
  )
]);

export default function(): Rule {
  return chain([
    addExtensionRecommendations,
    addDotEnv,
    updateAngularCLI,
    migrateNgrx,
    updateNgrx,
    setDefaults,
    formatFiles()
  ]);
}
