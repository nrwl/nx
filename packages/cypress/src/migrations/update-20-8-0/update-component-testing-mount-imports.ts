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
  Printer,
  PropertyAssignment,
} from 'typescript';
import { resolveCypressConfigObject } from '../../utils/config';
import { cypressProjectConfigs } from '../../utils/migrations';

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

    const cypressConfig = tree.read(cypressConfigPath, 'utf-8');

    const migrationInfo = parseMigrationInfo(
      cypressConfig,
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
  cypressConfig: string,
  projectName: string,
  projectGraph: ProjectGraph
): {
  framework?: 'angular' | 'react';
  isLegacyVersion?: boolean;
} | null {
  const config = resolveCypressConfigObject(cypressConfig);

  if (!config) {
    // couldn't find the config object, leave as is
    return null;
  }

  const frameworkProperty = tsquery.query<PropertyAssignment>(
    config,
    'PropertyAssignment:has(Identifier[name=component]) PropertyAssignment:has(Identifier[name=devServer]) PropertyAssignment:has(Identifier[name=framework])'
  )[0];

  if (!frameworkProperty) {
    // component.devServer.framework is not defined, so it's not using
    // component testing or the config is not valid
    return null;
  }

  const framework =
    ts.isStringLiteral(frameworkProperty.initializer) &&
    frameworkProperty.initializer.getText().replace(/['"`]/g, '');

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
