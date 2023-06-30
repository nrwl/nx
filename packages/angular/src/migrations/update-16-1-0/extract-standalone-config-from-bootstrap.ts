import type { ProjectConfiguration, Tree } from '@nx/devkit';
import { formatFiles, joinPathFragments } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { dirname, relative, resolve } from 'path';
import type { Identifier, Node, SourceFile, StringLiteral } from 'typescript';
import { getProjectsFilteredByDependencies } from '../utils/projects';

let tsModule: typeof import('typescript');
let tsquery: typeof import('@phenomnomnominal/tsquery').tsquery;

function getBootstrapCallFileInfo(
  tree: Tree,
  project: ProjectConfiguration,
  mainFilePath: string
) {
  const IMPORT_BOOTSTRAP_FILE =
    'CallExpression:has(ImportKeyword) > StringLiteral';

  let bootstrapCallFilePath = mainFilePath;
  let bootstrapCallFileContents = tree.read(bootstrapCallFilePath, 'utf-8');

  const ast = tsquery.ast(bootstrapCallFileContents);
  const importBootstrapNodes = tsquery(ast, IMPORT_BOOTSTRAP_FILE, {
    visitAllChildren: true,
  });

  if (
    importBootstrapNodes.length > 0 &&
    importBootstrapNodes[0].getText().includes('./bootstrap')
  ) {
    bootstrapCallFilePath = joinPathFragments(
      project.sourceRoot,
      'bootstrap.ts'
    );
    bootstrapCallFileContents = tree.read(bootstrapCallFilePath, 'utf-8');
  }
  return { bootstrapCallFilePath, bootstrapCallFileContents };
}

function getImportTokenMap(bootstrapCallFileContentsAst: SourceFile) {
  const importTokenMap = new Map<string, string>();
  const importedTokensNodes = tsquery(
    bootstrapCallFileContentsAst,
    'ImportDeclaration > ImportClause',
    { visitAllChildren: true }
  );

  for (const node of importedTokensNodes) {
    importTokenMap.set(node.getText(), node.parent.getText());
  }
  return importTokenMap;
}

function getImportsRequiredForAppConfig(
  importTokenMap: Map<string, string>,
  appConfigNode: Node,
  oldSourceFilePath: string,
  newSourceFilePath: string
): { appConfigImports: string[]; importsToRemoveFromSource: string[] } {
  const identifiers = tsquery.query<Identifier>(
    appConfigNode,
    'Identifier:not(PropertyAssignment > Identifier)',
    { visitAllChildren: true }
  );

  const appConfigImports = new Set<string>();
  const originalImportsToRemove = new Set<string>();
  for (const identifier of identifiers) {
    for (const key of importTokenMap.keys()) {
      if (!key.includes(identifier.getText())) {
        continue;
      }

      let importText = importTokenMap.get(key);
      originalImportsToRemove.add(importText);

      if (
        oldSourceFilePath === newSourceFilePath ||
        oldSourceFilePath.split('/').length ===
          newSourceFilePath.split('/').length
      ) {
        appConfigImports.add(importText);
        continue;
      }

      const importPath = tsquery
        .query<StringLiteral>(importText, 'StringLiteral', {
          visitAllChildren: true,
        })[0]
        .getText()
        .replace(/'/g, '')
        .replace(/"/g, '');
      if (importPath.startsWith('.')) {
        const resolvedImportPath = resolve(
          dirname(oldSourceFilePath),
          importPath
        );
        const newRelativeImportPath = relative(
          dirname(newSourceFilePath),
          resolvedImportPath
        );
        importText = importText.replace(
          importPath,
          newRelativeImportPath.startsWith('.')
            ? newRelativeImportPath
            : `./${newRelativeImportPath}`
        );
      }

      appConfigImports.add(importText);
    }
  }

  return {
    appConfigImports: Array.from(appConfigImports),
    importsToRemoveFromSource: Array.from(originalImportsToRemove),
  };
}

function getAppConfigFileContents(
  importsRequiredForAppConfig: string[],
  appConfigText: string
) {
  const buildAppConfigFileContents = (
    importStatements: string[],
    appConfig: string
  ) => `import { ApplicationConfig } from '@angular/core';${importStatements.join(
    '\n'
  )}
        export const appConfig: ApplicationConfig = ${appConfig}`;

  const appConfigFileContents = buildAppConfigFileContents(
    importsRequiredForAppConfig,
    appConfigText
  );
  return appConfigFileContents;
}

function getBootstrapCallFileContents(
  bootstrapCallFileContents: string,
  appConfigNode: Node,
  importsRequiredForAppConfig: string[]
) {
  let newBootstrapCallFileContents = `import { appConfig } from './app/app.config';
${bootstrapCallFileContents.slice(
  0,
  appConfigNode.getStart()
)}appConfig${bootstrapCallFileContents.slice(appConfigNode.getEnd())}`;

  for (const importStatement of importsRequiredForAppConfig) {
    newBootstrapCallFileContents = newBootstrapCallFileContents.replace(
      importStatement,
      ''
    );
  }
  return newBootstrapCallFileContents;
}

export default async function extractStandaloneConfig(tree: Tree) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  if (!tsquery) {
    tsquery = require('@phenomnomnominal/tsquery').tsquery;
  }

  const projects = await getProjectsFilteredByDependencies(tree, [
    'npm:@angular/core',
  ]);

  const BOOTSTRAP_APPLICATION_CALL_SELECTOR =
    'CallExpression:has(Identifier[name=bootstrapApplication])';
  const BOOTSTRAP_APPLICATION_CALL_CONFIG_SELECTOR =
    'CallExpression:has(Identifier[name=bootstrapApplication]) > ObjectLiteralExpression';

  for (const { project } of projects) {
    if (project.projectType !== 'application') {
      continue;
    }
    if (project.targets?.build?.options?.main === undefined) {
      continue;
    }

    const { bootstrapCallFilePath, bootstrapCallFileContents } =
      getBootstrapCallFileInfo(
        tree,
        project,
        project.targets.build.options.main
      );

    const bootstrapCallFileContentsAst = tsquery.ast(bootstrapCallFileContents);
    const nodes: Node[] = tsquery(
      bootstrapCallFileContentsAst,
      BOOTSTRAP_APPLICATION_CALL_SELECTOR,
      { visitAllChildren: true }
    );
    if (nodes.length === 0) {
      continue;
    }

    const importTokenMap = getImportTokenMap(bootstrapCallFileContentsAst);

    const bootstrapCallNode = nodes[0];
    const appConfigNodes = tsquery(
      bootstrapCallNode,
      BOOTSTRAP_APPLICATION_CALL_CONFIG_SELECTOR,
      { visitAllChildren: true }
    );
    if (appConfigNodes.length === 0) {
      continue;
    }

    const appConfigNode = appConfigNodes[0];
    const appConfigText = appConfigNode.getText();
    const appConfigFilePath = joinPathFragments(
      project.sourceRoot,
      'app/app.config.ts'
    );

    const { appConfigImports, importsToRemoveFromSource } =
      getImportsRequiredForAppConfig(
        importTokenMap,
        appConfigNode,
        bootstrapCallFilePath,
        appConfigFilePath
      );

    const appConfigFileContents = getAppConfigFileContents(
      appConfigImports,
      appConfigText
    );

    tree.write(appConfigFilePath, appConfigFileContents);

    let newBootstrapCallFileContents = getBootstrapCallFileContents(
      bootstrapCallFileContents,
      appConfigNode,
      importsToRemoveFromSource
    );

    tree.write(bootstrapCallFilePath, newBootstrapCallFileContents);
  }

  await formatFiles(tree);
}
