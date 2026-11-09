import {
  addDependenciesToPackageJson,
  applyChangesToString,
  ChangeType,
  createProjectGraphAsync,
  formatFiles,
  visitNotIgnoredFiles,
  type ProjectConfiguration,
  type ProjectGraph,
  type StringChange,
  type Tree,
} from '@nx/devkit';
import {
  ensureTypescript,
  tsquery,
  type TypescriptAst,
} from '@nx/devkit/internal';
import { lt, valid } from 'semver';
import type { ImportDeclaration } from 'typescript';
import { resolveCypressConfigObject } from '../../utils/config';
import {
  cypressProjectConfigs,
  getObjectProperty,
} from '../../utils/migrations';

const DEPRECATED_MAX_ANGULAR_VERSION = '18.0.0';
const CYPRESS_ANGULAR_FALLBACK_VERSION = '^3.0.0';

let ts: TypescriptAst;

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

  visitNotIgnoredFiles(tree, projectConfig.root, (filePath) => {
    if (!isJsTsFile(filePath) || !tree.exists(filePath)) {
      return;
    }

    const originalContent = tree.read(filePath, 'utf-8');
    const changes = tsquery
      .query<ImportDeclaration>(originalContent, 'ImportDeclaration')
      .filter(
        ({ moduleSpecifier }) =>
          ts.isStringLiteral(moduleSpecifier) &&
          moduleSpecifier.text === 'cypress/angular'
      )
      .flatMap(({ moduleSpecifier }): StringChange[] => {
        const quote = moduleSpecifier.getText()[0];
        const start = moduleSpecifier.getStart();
        return [
          {
            type: ChangeType.Delete,
            start,
            length: moduleSpecifier.getEnd() - start,
          },
          {
            type: ChangeType.Insert,
            index: start,
            text: `${quote}@cypress/angular${quote}`,
          },
        ];
      });

    if (changes.length > 0) {
      tree.write(filePath, applyChangesToString(originalContent, changes));
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
