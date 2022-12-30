import type { Tree } from '@nrwl/devkit';
import {
  logger,
  readProjectConfiguration,
  updateJson,
  joinPathFragments,
  formatFiles,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

export default async function (tree: Tree) {
  const NRWL_WEBPACK_BROWSER_BUILDER = '@nrwl/angular:webpack-browser';
  const CUSTOM_WEBPACK_OPTION = 'customWebpackConfig';

  const projects: Record<string, string> = {};
  forEachExecutorOptions(
    tree,
    NRWL_WEBPACK_BROWSER_BUILDER,
    (opts, projectName) => {
      // Update the webpack config
      const webpackPath = opts[CUSTOM_WEBPACK_OPTION]?.path;
      if (!webpackPath || !tree.exists(webpackPath)) {
        return;
      }
      const webpackConfig = tree.read(webpackPath, 'utf-8');
      const ast = tsquery.ast(webpackConfig);
      const moduleFederationWebpackConfig = tsquery(
        ast,
        'Identifier[name=ModuleFederationPlugin]',
        {
          visitAllChildren: true,
        }
      );
      if (
        !moduleFederationWebpackConfig ||
        moduleFederationWebpackConfig.length === 0
      ) {
        return;
      }

      projects[projectName] = webpackPath;
    }
  );

  useShareHelper(tree, projects);
  turnMinimizeOn(tree, projects);
  switchToES2020(tree, projects);
  replaceBrowserModuleInRemoteEntry(tree, projects);

  await formatFiles(tree);
}

function replaceBrowserModuleInRemoteEntry(
  tree: Tree,
  projects: Record<string, string>
) {
  for (const projectName of Object.keys(projects)) {
    const remoteEntryModulePath = joinPathFragments(
      readProjectConfiguration(tree, projectName).sourceRoot,
      `app/remote-entry/entry.module.ts`
    );
    if (!tree.exists(remoteEntryModulePath)) {
      continue;
    }

    let remoteEntryModuleContents = tree.read(remoteEntryModulePath, 'utf-8');
    remoteEntryModuleContents = replaceBrowserModuleWithCommonFromRemoteEntry(
      remoteEntryModuleContents
    );

    tree.write(remoteEntryModulePath, remoteEntryModuleContents);
  }
}

export function replaceBrowserModuleWithCommonFromRemoteEntry(
  remoteEntryModule: string
): string {
  const IS_BROWSER_MODULE_IN_IMPORTS_AST_QUERY =
    'Identifier[name=imports] ~ ArrayLiteralExpression:has(Identifier[name=BrowserModule])';
  const IS_COMMON_MODULE_IMPORTED_AST_QUERY =
    'ImportDeclaration:has(ImportSpecifier:has(Identifier[name=CommonModule]))';
  const IS_COMMON_MODULE_IN_IMPORTS_AST_QUERY =
    'Identifier[name=imports] ~ ArrayLiteralExpression:has(Identifier[name=CommonModule])';
  const BROWSER_MODULE_POS_AST_QUERY =
    'Identifier[name=imports] ~ ArrayLiteralExpression > Identifier[name=BrowserModule]';

  let ast = tsquery.ast(remoteEntryModule);
  const importsArrayWithBrowserModule = tsquery(
    ast,
    IS_BROWSER_MODULE_IN_IMPORTS_AST_QUERY,
    { visitAllChildren: true }
  );

  const commonModuleImportsNode = tsquery(
    ast,
    IS_COMMON_MODULE_IN_IMPORTS_AST_QUERY,
    { visitAllChildren: true }
  );
  const commonModuleImportedInFileNode = tsquery(
    ast,
    IS_COMMON_MODULE_IMPORTED_AST_QUERY,
    { visitAllChildren: true }
  );

  const hasBrowserModule =
    importsArrayWithBrowserModule && importsArrayWithBrowserModule.length > 0;
  const needsCommonModuleInImports =
    !commonModuleImportsNode || commonModuleImportsNode.length < 1;
  const needsCommonModuleImportStatement =
    !commonModuleImportedInFileNode ||
    commonModuleImportedInFileNode.length < 1;

  if (!hasBrowserModule) {
    if (needsCommonModuleInImports && needsCommonModuleImportStatement) {
      // no browser module and no common module imported
      const IMPORTS_ARRAY_POS_AST_QUERY =
        'Identifier[name=imports] ~ ArrayLiteralExpression';
      const importsArrayNode = tsquery(ast, IMPORTS_ARRAY_POS_AST_QUERY, {
        visitAllChildren: true,
      })[0];
      const updatedRemoteEntry = `import { CommonModule } from '@angular/common';\n${remoteEntryModule.slice(
        0,
        importsArrayNode.getStart() + 1
      )}\nCommonModule,${remoteEntryModule.slice(
        importsArrayNode.getStart() + 1
      )}`;
      return updatedRemoteEntry;
    } else {
      return remoteEntryModule;
    }
  }

  const browserModuleNode = tsquery(ast, BROWSER_MODULE_POS_AST_QUERY, {
    visitAllChildren: true,
  })[0];

  const updatedRemoteEntryModule = `${
    needsCommonModuleImportStatement
      ? `import { CommonModule } from '@angular/common';\n`
      : ``
  }${remoteEntryModule.slice(0, browserModuleNode.getStart())}${
    needsCommonModuleInImports ? `CommonModule` : ``
  }${remoteEntryModule.slice(
    browserModuleNode.getEnd() + (needsCommonModuleInImports ? 0 : 1)
  )}`;

  return updatedRemoteEntryModule;
}

function switchToES2020(tree: Tree, projects: Record<string, string>) {
  for (const projectName of Object.keys(projects)) {
    const { root } = readProjectConfiguration(tree, projectName);
    let tsConfigPath = tree.exists(joinPathFragments(root, `tsconfig.app.json`))
      ? joinPathFragments(root, `tsconfig.app.json`)
      : joinPathFragments(root, `tsconfig.json`);
    updateJson(tree, tsConfigPath, (json) => ({
      ...json,
      compilerOptions: {
        ...json.compilerOptions,
        target: 'ES2020',
      },
    }));
  }
}

function turnMinimizeOn(tree: Tree, projects: Record<string, string>) {
  for (const webpackPath of Object.values(projects)) {
    let webpackConfig = tree.read(webpackPath, 'utf-8');
    tree.write(
      webpackPath,
      modifyConfigToUseMinimizeOptimization(webpackConfig)
    );
  }
}

export function modifyConfigToUseMinimizeOptimization(
  webpackConfig: string
): string {
  const OPTIMIZATION_OBJECT_AST_QUERY =
    'PropertyAssignment:has(Identifier[name=optimization]) > ObjectLiteralExpression';
  let ast = tsquery.ast(webpackConfig);
  const optimizationObjectNode = tsquery(ast, OPTIMIZATION_OBJECT_AST_QUERY, {
    visitAllChildren: true,
  })[0];

  const minimizeTrueNode = tsquery(
    optimizationObjectNode,
    'Identifier[name=minimize] ~ TrueKeyword',
    { visitAllChildren: true }
  );
  if (minimizeTrueNode && minimizeTrueNode.length > 0) {
    // it's already turned on
    return webpackConfig;
  }

  const minimizeFalseNode = tsquery(
    optimizationObjectNode,
    'Identifier[name=minimize] ~ FalseKeyword',
    { visitAllChildren: true }
  );
  if (minimizeFalseNode && minimizeFalseNode.length > 0) {
    // it exists but it's set to false, so flip it
    webpackConfig = `${webpackConfig.slice(
      0,
      minimizeFalseNode[0].getStart()
    )}true${webpackConfig.slice(minimizeFalseNode[0].getEnd())}`;

    return webpackConfig;
  }

  return webpackConfig;
}

function useShareHelper(tree: Tree, projects: Record<string, string>) {
  for (const webpackPath of Object.values(projects)) {
    let webpackConfig = tree.read(webpackPath, 'utf-8');
    tree.write(webpackPath, modifyConfigToUseShareHelper(webpackConfig));
  }
}

export function modifyConfigToUseShareHelper(webpackConfig: string): string {
  const SHARE_CALL_AST_QUERY = 'CallExpression:has(Identifier[name=share])';
  const MODULE_EXPORTS_AST_QUERY =
    'ExpressionStatement:has(BinaryExpression:has(PropertyAccessExpression:has(Identifier[name=module], Identifier[name=exports])))';
  const SHARED_OBJECT_AST_QUERY =
    'PropertyAssignment:has(Identifier[name=shared]) > ObjectLiteralExpression';

  let ast = tsquery.ast(webpackConfig);
  const shareCall = tsquery(ast, SHARE_CALL_AST_QUERY, {
    visitAllChildren: true,
  });

  if (shareCall && shareCall.length > 0) {
    // skip this project if it's already using share
    return webpackConfig;
  }
  const sharedObject = tsquery(ast, SHARED_OBJECT_AST_QUERY, {
    visitAllChildren: true,
  });

  if (!sharedObject || sharedObject.length < 1) {
    // skip because there are no libs being shared
    return webpackConfig;
  }

  const sharedObjectNode = sharedObject[0];
  webpackConfig = `${webpackConfig.slice(
    0,
    sharedObjectNode.getStart()
  )}share(${webpackConfig.slice(
    sharedObjectNode.getStart(),
    sharedObjectNode.getEnd()
  )})${webpackConfig.slice(sharedObjectNode.getEnd())}`;

  // wrap the shared libs in the function
  ast = tsquery.ast(webpackConfig);
  const moduleExportsStatement = tsquery(ast, MODULE_EXPORTS_AST_QUERY, {
    visitAllChildren: true,
  })[0];
  webpackConfig = `${webpackConfig.slice(
    0,
    moduleExportsStatement.getStart()
  )}const share = mf.share;\nmf.setInferVersion(true);\n${webpackConfig.slice(
    moduleExportsStatement.getStart()
  )}`;

  return webpackConfig;
}
