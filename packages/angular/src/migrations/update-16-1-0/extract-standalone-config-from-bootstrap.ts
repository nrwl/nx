import type { ProjectConfiguration, Tree } from '@nx/devkit';
import { formatFiles, getProjects, joinPathFragments } from '@nx/devkit';
import type { Node, SourceFile } from 'typescript';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');
let tsquery: typeof import('@phenomnomnominal/tsquery').tsquery;

function getBootstrapCallFileInfo<T>(
  project: ProjectConfiguration,
  tree: Tree
) {
  const IMPORT_BOOTSTRAP_FILE =
    'CallExpression:has(ImportKeyword) > StringLiteral';

  let bootstrapCallFilePath = project.targets?.build?.options?.main;
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
  appConfigNode: Node
) {
  const importsRequiredForAppConfig = new Set<string>();
  const checkImportsForTokens = (nodeText: string) => {
    const keys = importTokenMap.keys();
    for (const key of keys) {
      if (key.includes(nodeText))
        importsRequiredForAppConfig.add(importTokenMap.get(key));
    }
  };
  const visitEachChild = (node: Node) => {
    node.forEachChild((node) => {
      const nodeText = node.getText();
      checkImportsForTokens(nodeText);
      visitEachChild(node);
    });
  };
  visitEachChild(appConfigNode);
  return importsRequiredForAppConfig;
}

function getAppConfigFileContents(
  importsRequiredForAppConfig: Set<string>,
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
    Array.from(importsRequiredForAppConfig),
    appConfigText
  );
  return appConfigFileContents;
}

function getBootstrapCallFileContents(
  bootstrapCallFileContents: string,
  appConfigNode: Node,
  importsRequiredForAppConfig: Set<string>
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

  const projects = getProjects(tree);

  const BOOTSTRAP_APPLICATION_CALL_SELECTOR =
    'CallExpression:has(Identifier[name=bootstrapApplication])';
  const BOOTSTRAP_APPLICATION_CALL_CONFIG_SELECTOR =
    'CallExpression:has(Identifier[name=bootstrapApplication]) > ObjectLiteralExpression';

  for (const [projectName, project] of projects.entries()) {
    if (project.projectType !== 'application') {
      continue;
    }
    if (project.targets?.build?.options?.main === undefined) {
      continue;
    }

    const { bootstrapCallFilePath, bootstrapCallFileContents } =
      getBootstrapCallFileInfo(project, tree);

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

    const importsRequiredForAppConfig = getImportsRequiredForAppConfig(
      importTokenMap,
      appConfigNode
    );

    const appConfigFilePath = joinPathFragments(
      project.sourceRoot,
      'app/app.config.ts'
    );

    const appConfigFileContents = getAppConfigFileContents(
      importsRequiredForAppConfig,
      appConfigText
    );

    tree.write(appConfigFilePath, appConfigFileContents);

    let newBootstrapCallFileContents = getBootstrapCallFileContents(
      bootstrapCallFileContents,
      appConfigNode,
      importsRequiredForAppConfig
    );

    tree.write(bootstrapCallFilePath, newBootstrapCallFileContents);
  }

  await formatFiles(tree);
}
