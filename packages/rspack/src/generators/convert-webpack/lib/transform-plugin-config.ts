import { type Tree } from '@nx/devkit';
import { ast, query } from '@phenomnomnominal/tsquery';
import * as ts from 'typescript';

export function transformPluginConfig(tree: Tree, webpackConfigPath: string) {
  const webpackConfigContents = tree.read(webpackConfigPath, 'utf-8');
  let sourceFile = ast(webpackConfigContents);
  let newConfigContents = webpackConfigContents;
  if (webpackConfigContents.includes("require('@nx/webpack/app-plugin')")) {
    newConfigContents = transformCjsConfig(
      tree,
      webpackConfigContents,
      sourceFile
    );
  } else {
    newConfigContents = transformEsmConfig(
      tree,
      webpackConfigContents,
      sourceFile
    );
  }
  tree.write(webpackConfigPath, newConfigContents);
}

function transformCjsConfig(
  tree: Tree,
  webpackConfigContents: string,
  sourceFile: ts.SourceFile
) {
  // Convert require('@nx/webpack/app-plugin') to require('@nx/rspack/app-plugin')
  const WEBPACK_APP_PLUGIN_REQUIRE_SELECTOR =
    'CallExpression:has(Identifier[name=require]) > StringLiteral[value=@nx/webpack/app-plugin]';
  let nodes = query(sourceFile, WEBPACK_APP_PLUGIN_REQUIRE_SELECTOR);
  if (nodes.length === 0) {
    return webpackConfigContents;
  }

  const requireNode = nodes[0];
  webpackConfigContents = `${webpackConfigContents.slice(
    0,
    requireNode.getStart()
  )}'@nx/rspack/app-plugin'${webpackConfigContents.slice(
    requireNode.getEnd()
  )}`;

  // Convert const { NxAppWebpackPlugin } to const { NxAppRspackPlugin }
  sourceFile = ast(webpackConfigContents);

  const WEBPACK_APP_BINDING_ELEMENT_SELECTOR =
    'BindingElement:has(Identifier[name=NxAppWebpackPlugin])';

  nodes = query(sourceFile, WEBPACK_APP_BINDING_ELEMENT_SELECTOR);
  if (nodes.length === 0) {
    return webpackConfigContents;
  }
  const bindingElement = nodes[0];
  webpackConfigContents = `${webpackConfigContents.slice(
    0,
    bindingElement.getStart()
  )}NxAppRspackPlugin${webpackConfigContents.slice(bindingElement.getEnd())}`;

  // Convert new NxAppWebpackPlugin() to new NxAppRspackPlugin()
  sourceFile = ast(webpackConfigContents);

  const WEBPACK_APP_INSTANTIATION_SELECTOR =
    'NewExpression > Identifier[name=NxAppWebpackPlugin]';
  nodes = query(sourceFile, WEBPACK_APP_INSTANTIATION_SELECTOR);
  if (nodes.length === 0) {
    return webpackConfigContents;
  }
  const instantiation = nodes[0];
  webpackConfigContents = `${webpackConfigContents.slice(
    0,
    instantiation.getStart()
  )}NxAppRspackPlugin${webpackConfigContents.slice(instantiation.getEnd())}`;

  return webpackConfigContents;
}

function transformEsmConfig(
  tree: Tree,
  webpackConfigContents: string,
  sourceFile: ts.SourceFile
) {
  // Convert from '@nx/webpack/app-plugin' to from '@nx/rspack/app-plugin'
  const WEBPACK_APP_PLUGIN_IMPORT_SELECTOR =
    'ImportClause ~ StringLiteral[value=@nx/webpack/app-plugin]';
  let nodes = query(sourceFile, WEBPACK_APP_PLUGIN_IMPORT_SELECTOR);
  if (nodes.length === 0) {
    return webpackConfigContents;
  }

  const importNode = nodes[0];
  webpackConfigContents = `${webpackConfigContents.slice(
    0,
    importNode.getStart()
  )}'@nx/rspack/app-plugin'${webpackConfigContents.slice(importNode.getEnd())}`;

  // Convert import { NxAppWebpackPlugin } to import { NxAppRspackPlugin }
  sourceFile = ast(webpackConfigContents);

  const WEBPACK_APP_IMPORT_SPECIFIER_SELECTOR =
    'ImportSpecifier > Identifier[name=NxAppWebpackPlugin]';

  nodes = query(sourceFile, WEBPACK_APP_IMPORT_SPECIFIER_SELECTOR);
  if (nodes.length === 0) {
    return webpackConfigContents;
  }
  const importSpecifier = nodes[0];
  webpackConfigContents = `${webpackConfigContents.slice(
    0,
    importSpecifier.getStart()
  )}NxAppRspackPlugin${webpackConfigContents.slice(importSpecifier.getEnd())}`;

  // Convert new NxAppWebpackPlugin() to new NxAppRspackPlugin()
  sourceFile = ast(webpackConfigContents);

  const WEBPACK_APP_INSTANTIATION_SELECTOR =
    'NewExpression > Identifier[name=NxAppWebpackPlugin]';
  nodes = query(sourceFile, WEBPACK_APP_INSTANTIATION_SELECTOR);
  if (nodes.length === 0) {
    return webpackConfigContents;
  }
  const instantiation = nodes[0];
  webpackConfigContents = `${webpackConfigContents.slice(
    0,
    instantiation.getStart()
  )}NxAppRspackPlugin${webpackConfigContents.slice(instantiation.getEnd())}`;

  return webpackConfigContents;
}
