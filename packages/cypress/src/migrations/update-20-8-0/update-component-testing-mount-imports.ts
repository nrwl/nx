import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  formatFiles,
  visitNotIgnoredFiles,
  type ProjectConfiguration,
  type ProjectGraph,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import { lt, valid } from 'semver';
import type {
  ImportDeclaration,
  ObjectLiteralExpression,
  Printer,
  PropertyAssignment,
} from 'typescript';
import { resolveCypressConfigObject } from '../../utils/config';
import {
  cypressProjectConfigs,
  getObjectProperty,
} from '../../utils/migrations';

let printer: Printer;
let ts: typeof import('typescript');

export default async function (tree: Tree) {
  const projectGraph = await createProjectGraphAsync();

  for await (const {
    cypressConfigPath,
    projectName,
    projectConfig,
  } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      // cypress config file doesn't exist, so skip
      continue;
    }

    ts ??= ensureTypescript();
    printer ??= ts.createPrinter();

    const migrationInfo = parseMigrationInfo(
      tree,
      cypressConfigPath,
      projectName,
      projectGraph
    );

    if (!migrationInfo) {
      continue;
    }

    if (migrationInfo.framework === 'angular') {
      migrateAngularFramework(
        tree,
        projectConfig,
        migrationInfo.isLegacyVersion
      );
    } else if (migrationInfo.framework === 'react') {
      migrateReactFramework(tree, projectConfig);
    }
  }

  await formatFiles(tree);
}

function parseMigrationInfo(
  tree: Tree,
  cypressConfigPath: string,
  projectName: string,
  projectGraph: ProjectGraph
): {
  framework?: 'angular' | 'react';
  isLegacyVersion?: boolean;
} | null {
  const cypressConfig = tree.read(cypressConfigPath, 'utf-8');
  const config = resolveCypressConfigObject(cypressConfig);

  if (!config) {
    // couldn't find the config object, leave as is
    return null;
  }

  if (!getObjectProperty(config, 'component')) {
    // no component config, leave as is
    return null;
  }

  const framework = resolveFramework(
    cypressConfig,
    config,
    projectName,
    projectGraph
  );

  if (framework === 'react') {
    return { framework: 'react' };
  }

  if (framework === 'angular') {
    const angularCoreDep = projectGraph.dependencies[projectName].find((d) =>
      // account for possible different versions of angular core
      d.target.startsWith('npm:@angular/core')
    );
    if (angularCoreDep) {
      const angularVersion =
        projectGraph.externalNodes?.[angularCoreDep.target]?.data?.version;
      if (valid(angularVersion) && lt(angularVersion, '17.2.0')) {
        return {
          framework: 'angular',
          isLegacyVersion: true,
        };
      }
    }

    return {
      framework: 'angular',
      isLegacyVersion: false,
    };
  }

  return null;
}

function resolveFramework(
  cypressConfig: string,
  config: ObjectLiteralExpression,
  projectName: string,
  projectGraph: ProjectGraph
): string | null {
  const frameworkProperty = tsquery.query<PropertyAssignment>(
    config,
    'PropertyAssignment:has(Identifier[name=component]) PropertyAssignment:has(Identifier[name=devServer]) PropertyAssignment:has(Identifier[name=framework])'
  )[0];

  if (frameworkProperty) {
    return ts.isStringLiteral(frameworkProperty.initializer)
      ? frameworkProperty.initializer.getText().replace(/['"`]/g, '')
      : null;
  }

  // component might be assigned to an Nx preset function call, so we try to
  // infer the framework from the Nx preset import
  const sourceFile = tsquery.ast(cypressConfig);
  const nxPresetModuleSpecifiers = [
    '@nx/angular/plugins/component-testing',
    '@nx/react/plugins/component-testing',
    '@nx/next/plugins/component-testing',
    '@nx/remix/plugins/component-testing',
  ];
  const nxPresetImportModuleSpecifier = sourceFile.statements
    .find(
      (s): s is ImportDeclaration =>
        ts.isImportDeclaration(s) &&
        nxPresetModuleSpecifiers.includes(
          s.moduleSpecifier.getText().replace(/['"`]/g, '')
        )
    )
    ?.moduleSpecifier.getText()
    .replace(/['"`]/g, '');
  if (nxPresetImportModuleSpecifier) {
    const plugin = nxPresetImportModuleSpecifier.split('/').at(1);

    return plugin === 'angular' ? 'angular' : 'react';
  }

  // it might be set to something else, so we fall back to checking the
  // project dependencies
  if (
    projectGraph.dependencies[projectName]?.some((d) =>
      d.target.startsWith('npm:@angular/core')
    )
  ) {
    return 'angular';
  }

  if (
    projectGraph.dependencies[projectName]?.some(
      (d) => d.target.startsWith('npm:react') || d.target.startsWith('npm:next')
    )
  ) {
    return 'react';
  }

  return null;
}

// https://docs.cypress.io/app/references/migration-guide#Angular-1720-CT-no-longer-supported
function migrateAngularFramework(
  tree: Tree,
  projectConfig: ProjectConfiguration,
  isLegacyVersion: boolean
) {
  visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
    if (!isJsTsFile(filePath)) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');

    let updatedFileContent: string;
    if (isLegacyVersion) {
      let needPackage = false;

      updatedFileContent = tsquery.replace(
        content,
        'ImportDeclaration',
        importTransformerFactory(
          content,
          'cypress/angular',
          '@cypress/angular',
          () => {
            needPackage = true;
          }
        )
      );

      if (needPackage) {
        addDependenciesToPackageJson(
          tree,
          {},
          { '@cypress/angular': '^2.1.0' },
          undefined,
          true
        );
      }
    } else {
      updatedFileContent = tsquery.replace(
        content,
        'ImportDeclaration',
        importTransformerFactory(
          content,
          'cypress/angular-signals',
          'cypress/angular'
        )
      );
    }

    tree.write(filePath, updatedFileContent);
  });
}

// https://docs.cypress.io/app/references/migration-guide#React-18-CT-no-longer-supported
function migrateReactFramework(
  tree: Tree,
  projectConfig: ProjectConfiguration
) {
  visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
    if (!isJsTsFile(filePath)) {
      return;
    }

    const content = tree.read(filePath, 'utf-8');
    const updatedContent = tsquery.replace(
      content,
      'ImportDeclaration',
      importTransformerFactory(content, 'cypress/react18', 'cypress/react')
    );

    tree.write(filePath, updatedContent);
  });
}

function importTransformerFactory(
  fileContent: string,
  sourceModuleSpecifier: string,
  targetModuleSpecifier: string,
  matchImportCallback?: () => void
): Parameters<typeof tsquery.replace>[2] {
  return (node: ImportDeclaration) => {
    if (
      node.moduleSpecifier.getText().replace(/['"`]/g, '') ===
      sourceModuleSpecifier
    ) {
      matchImportCallback?.();
      const updatedImport = ts.factory.updateImportDeclaration(
        node,
        node.modifiers,
        node.importClause,
        ts.factory.createStringLiteral(targetModuleSpecifier),
        node.attributes
      );

      return printer.printNode(
        ts.EmitHint.Unspecified,
        updatedImport,
        tsquery.ast(fileContent)
      );
    }

    return node.getText();
  };
}

function isJsTsFile(filePath: string) {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}
