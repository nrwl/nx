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
import type { ImportDeclaration, Printer } from 'typescript';
import { resolveCypressConfigObject } from '../../utils/config';
import {
  cypressProjectConfigs,
  getObjectProperty,
} from '../../utils/migrations';

const DEPRECATED_MAX_ANGULAR_VERSION = '18.0.0';
const CYPRESS_ANGULAR_FALLBACK_VERSION = '^3.0.0';

let printer: Printer;
let ts: typeof import('typescript');

export default async function updateAngularComponentTestingSupport(tree: Tree) {
  const projectGraph = await createProjectGraphAsync();
  let wereProjectsMigrated = false;

  for await (const {
    projectConfig,
    projectName,
    cypressConfigPath,
  } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      continue;
    }

    const migrationInfo = await getMigrationInfo(
      tree,
      cypressConfigPath,
      projectName,
      projectGraph
    );

    if (!migrationInfo) {
      continue;
    }

    migrateProject(tree, projectConfig);
    wereProjectsMigrated = true;
  }

  if (wereProjectsMigrated) {
    addDependenciesToPackageJson(
      tree,
      {},
      {
        '@cypress/angular': CYPRESS_ANGULAR_FALLBACK_VERSION,
      }
    );
  }

  await formatFiles(tree);
}

async function getMigrationInfo(
  tree: Tree,
  cypressConfigPath: string,
  projectName: string,
  projectGraph: ProjectGraph
): Promise<boolean> {
  ts ??= ensureTypescript();

  const cypressConfig = tree.read(cypressConfigPath, 'utf-8');
  const config = resolveCypressConfigObject(cypressConfig);

  if (!config) {
    return false;
  }

  const component = getObjectProperty(config, 'component');
  if (!component) {
    return false;
  }

  const framework = resolveFramework(
    cypressConfig,
    config,
    projectName,
    projectGraph
  );

  if (framework !== 'angular') {
    return false;
  }

  const angularVersion = resolveAngularVersion(projectName, projectGraph);

  if (!angularVersion || !valid(angularVersion)) {
    return false;
  }

  return lt(angularVersion, DEPRECATED_MAX_ANGULAR_VERSION);
}

function migrateProject(tree: Tree, projectConfig: ProjectConfiguration) {
  ts ??= ensureTypescript();
  printer ??= ts.createPrinter();

  visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
    if (!isJsTsFile(filePath) || !tree.exists(filePath)) {
      return;
    }

    const originalContent = tree.read(filePath, 'utf-8');
    const sourceFile = tsquery.ast(originalContent);
    const updatedContent = tsquery.replace(
      originalContent,
      'ImportDeclaration',
      (node: ImportDeclaration) => {
        if (
          !ts.isStringLiteral(node.moduleSpecifier) ||
          node.moduleSpecifier.text !== 'cypress/angular'
        ) {
          return node.getText();
        }

        const updatedImport = ts.factory.updateImportDeclaration(
          node,
          node.modifiers,
          node.importClause,
          ts.factory.createStringLiteral('@cypress/angular'),
          node.attributes
        );

        return printer.printNode(
          ts.EmitHint.Unspecified,
          updatedImport,
          sourceFile
        );
      }
    );

    if (updatedContent !== originalContent) {
      tree.write(filePath, updatedContent);
    }
  });
}

function resolveFramework(
  cypressConfig: string,
  config: import('typescript').ObjectLiteralExpression,
  projectName: string,
  projectGraph: ProjectGraph
): 'angular' | 'react' | null {
  ts ??= ensureTypescript();

  const frameworkProperty = tsquery.query<
    import('typescript').PropertyAssignment
  >(
    config,
    'PropertyAssignment:has(Identifier[name=component]) PropertyAssignment:has(Identifier[name=devServer]) PropertyAssignment:has(Identifier[name=framework])'
  )[0];

  if (frameworkProperty) {
    return ts.isStringLiteral(frameworkProperty.initializer)
      ? (frameworkProperty.initializer.text as 'angular' | 'react' | null)
      : null;
  }

  const sourceFile = tsquery.ast(cypressConfig);
  const nxPresetModuleSpecifiers = [
    '@nx/angular/plugins/component-testing',
    '@nx/react/plugins/component-testing',
    '@nx/next/plugins/component-testing',
    '@nx/remix/plugins/component-testing',
  ];

  const imports = tsquery.query<ImportDeclaration>(
    sourceFile,
    'ImportDeclaration'
  );

  const nxPresetImport = imports.find((decl) => {
    const moduleSpec = decl.moduleSpecifier.getText().replace(/['"`]/g, '');
    return nxPresetModuleSpecifiers.includes(moduleSpec);
  });

  if (nxPresetImport) {
    const moduleSpecifier = nxPresetImport.moduleSpecifier
      .getText()
      .replace(/['"`]/g, '');
    const plugin = moduleSpecifier.split('/').at(1);
    return plugin === 'angular' ? 'angular' : 'react';
  }

  if (
    projectGraph.dependencies[projectName]?.some((dependency) =>
      dependency.target.startsWith('npm:@angular/core')
    )
  ) {
    return 'angular';
  }

  if (
    projectGraph.dependencies[projectName]?.some(
      (dependency) =>
        dependency.target.startsWith('npm:react') ||
        dependency.target.startsWith('npm:next')
    )
  ) {
    return 'react';
  }

  return null;
}

function resolveAngularVersion(
  projectName: string,
  projectGraph: ProjectGraph
): string | null {
  const angularDep = projectGraph.dependencies[projectName]?.find(
    (dependency) => dependency.target.startsWith('npm:@angular/core')
  );

  if (!angularDep) {
    return null;
  }

  return projectGraph.externalNodes?.[angularDep.target]?.data?.version ?? null;
}

function isJsTsFile(filePath: string): boolean {
  return /\.[cm]?[jt]sx?$/.test(filePath);
}
