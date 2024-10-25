import type { Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

export function transformCjsConfigFile(tree: Tree, configPath: string) {
  ['@nx', '@nrwl'].forEach((scope: '@nx' | '@nrwl') => {
    transformComposePlugins(tree, configPath, scope);
    transformWithNx(tree, configPath, scope);
    transformWithWeb(tree, configPath, scope);
    transformWithReact(tree, configPath, scope);
    transformModuleFederationConfig(tree, configPath, scope);
    transformWithModuleFederation(tree, configPath, scope);
    transformWithModuleFederationSSR(tree, configPath, scope);
  });
}

function transformComposePlugins(
  tree: Tree,
  configPath: string,
  scope: '@nx' | '@nrwl'
) {
  const configContents = tree.read(configPath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const HAS_COMPOSE_PLUGINS_FROM_NX_WEBPACK = `VariableDeclaration:has(Identifier[name=composePlugins]) > CallExpression:has(Identifier[name=require]) StringLiteral[value=${scope}/webpack]`;
  const nodes = tsquery(ast, HAS_COMPOSE_PLUGINS_FROM_NX_WEBPACK);
  if (nodes.length === 0) {
    return;
  }

  const COMPOSE_PLUGINS_IMPORT =
    'VariableDeclaration:has(Identifier[name=composePlugins]) Identifier[name=composePlugins]';
  const composePluginsNodes = tsquery(ast, COMPOSE_PLUGINS_IMPORT);
  if (nodes.length === 0) {
    return;
  }

  const startIndex = composePluginsNodes[0].getStart();
  let endIndex = composePluginsNodes[0].getEnd();
  if (configContents.charAt(endIndex) === ',') {
    endIndex++;
  }

  const newContents = `const { composePlugins } = require('@nx/rspack');
  ${configContents.slice(0, startIndex)}${configContents.slice(endIndex)}`;

  tree.write(configPath, newContents);
}

function transformWithNx(
  tree: Tree,
  configPath: string,
  scope: '@nx' | '@nrwl'
) {
  const configContents = tree.read(configPath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const HAS_WITH_NX_FROM_NX_WEBPACK = `VariableDeclaration:has(Identifier[name=withNx]) > CallExpression:has(Identifier[name=require]) StringLiteral[value=${scope}/webpack]`;
  const nodes = tsquery(ast, HAS_WITH_NX_FROM_NX_WEBPACK);
  if (nodes.length === 0) {
    return;
  }

  const WITH_NX_IMPORT =
    'VariableDeclaration:has(Identifier[name=withNx]) Identifier[name=withNx]';
  const withNxNodes = tsquery(ast, WITH_NX_IMPORT);
  if (nodes.length === 0) {
    return;
  }

  const startIndex = withNxNodes[0].getStart();
  let endIndex = withNxNodes[0].getEnd();
  if (configContents.charAt(endIndex) === ',') {
    endIndex++;
  }

  const newContents = `const { withNx } = require('@nx/rspack');
  ${configContents.slice(0, startIndex)}${configContents.slice(endIndex)}`;

  tree.write(configPath, newContents);
}

function transformWithWeb(
  tree: Tree,
  configPath: string,
  scope: '@nx' | '@nrwl'
) {
  const configContents = tree.read(configPath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const HAS_WITH_WEB_FROM_NX_WEBPACK = `VariableDeclaration:has(Identifier[name=withWeb]) > CallExpression:has(Identifier[name=require]) StringLiteral[value=${scope}/webpack]`;
  const nodes = tsquery(ast, HAS_WITH_WEB_FROM_NX_WEBPACK);
  if (nodes.length === 0) {
    return;
  }

  const WITH_WEB_IMPORT =
    'VariableDeclaration:has(Identifier[name=withWeb]) Identifier[name=withWeb]';
  const withWebNodes = tsquery(ast, WITH_WEB_IMPORT);
  if (nodes.length === 0) {
    return;
  }

  const startIndex = withWebNodes[0].getStart();
  let endIndex = withWebNodes[0].getEnd();
  if (configContents.charAt(endIndex) === ',') {
    endIndex++;
  }

  const newContents = `const { withWeb } = require('@nx/rspack');
  ${configContents.slice(0, startIndex)}${configContents.slice(endIndex)}`;

  tree.write(configPath, newContents);
}

function transformWithReact(
  tree: Tree,
  configPath: string,
  scope: '@nx' | '@nrwl'
) {
  const configContents = tree.read(configPath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const HAS_WITH_REACT_FROM_NX_REACT = `VariableDeclaration:has(Identifier[name=withReact]) > CallExpression:has(Identifier[name=require]) StringLiteral[value=${scope}/react]`;
  const nodes = tsquery(ast, HAS_WITH_REACT_FROM_NX_REACT);
  if (nodes.length === 0) {
    return;
  }

  const WITH_REACT_IMPORT =
    'VariableDeclaration:has(Identifier[name=withReact]) Identifier[name=withReact]';
  const withReactNodes = tsquery(ast, WITH_REACT_IMPORT);
  if (nodes.length === 0) {
    return;
  }

  const startIndex = withReactNodes[0].getStart();
  let endIndex = withReactNodes[0].getEnd();
  if (configContents.charAt(endIndex) === ',') {
    endIndex++;
  }

  const newContents = `const { withReact } = require('@nx/rspack');
  ${configContents.slice(0, startIndex)}${configContents.slice(endIndex)}`;

  tree.write(configPath, newContents);
}

function transformModuleFederationConfig(
  tree: Tree,
  configPath: string,
  scope: '@nx' | '@nrwl'
) {
  const configContents = tree.read(configPath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const HAS_WITH_MODULE_FEDERATION_FROM_NX_REACT = `VariableDeclaration:has(Identifier[name=ModuleFederationConfig]) > CallExpression:has(Identifier[name=require]) StringLiteral[value=${scope}/webpack]`;
  const nodes = tsquery(ast, HAS_WITH_MODULE_FEDERATION_FROM_NX_REACT);
  if (nodes.length === 0) {
    return;
  }

  const WITH_MODULE_FEDERATION_IMPORT =
    'VariableDeclaration:has(Identifier[name=ModuleFederationConfig]) Identifier[name=ModuleFederationConfig]';
  const withModuleFederationNodes = tsquery(ast, WITH_MODULE_FEDERATION_IMPORT);
  if (nodes.length === 0) {
    return;
  }

  const startIndex = withModuleFederationNodes[0].getStart();
  let endIndex = withModuleFederationNodes[0].getEnd();
  if (configContents.charAt(endIndex) === ',') {
    endIndex++;
  }

  const newContents = `const { ModuleFederationConfig } = require('@nx/rspack/module-federation');
  ${configContents.slice(0, startIndex)}${configContents.slice(endIndex)}`;

  tree.write(configPath, newContents);
}

function transformWithModuleFederation(
  tree: Tree,
  configPath: string,
  scope: '@nx' | '@nrwl'
) {
  const configContents = tree.read(configPath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const HAS_WITH_MODULE_FEDERATION_FROM_NX_REACT = `VariableDeclaration:has(Identifier[name=withModuleFederation]) > CallExpression:has(Identifier[name=require]) StringLiteral[value=${scope}/react/module-federation]`;
  const nodes = tsquery(ast, HAS_WITH_MODULE_FEDERATION_FROM_NX_REACT);
  if (nodes.length === 0) {
    return;
  }

  const WITH_MODULE_FEDERATION_IMPORT =
    'VariableDeclaration:has(Identifier[name=withModuleFederation]) Identifier[name=withModuleFederation]';
  const withModuleFederationNodes = tsquery(ast, WITH_MODULE_FEDERATION_IMPORT);
  if (nodes.length === 0) {
    return;
  }

  const startIndex = withModuleFederationNodes[0].getStart();
  let endIndex = withModuleFederationNodes[0].getEnd();
  if (configContents.charAt(endIndex) === ',') {
    endIndex++;
  }

  const newContents = `const { withModuleFederation } = require('@nx/rspack/module-federation');
  ${configContents.slice(0, startIndex)}${configContents.slice(endIndex)}`;

  tree.write(configPath, newContents);
}

function transformWithModuleFederationSSR(
  tree: Tree,
  configPath: string,
  scope: '@nx' | '@nrwl'
) {
  const configContents = tree.read(configPath, 'utf-8');
  const ast = tsquery.ast(configContents);

  const HAS_WITH_MODULE_FEDERATION_FROM_NX_REACT = `VariableDeclaration:has(Identifier[name=withModuleFederationForSSR]) > CallExpression:has(Identifier[name=require]) StringLiteral[value=${scope}/react/module-federation]`;
  const nodes = tsquery(ast, HAS_WITH_MODULE_FEDERATION_FROM_NX_REACT);
  if (nodes.length === 0) {
    return;
  }

  const WITH_MODULE_FEDERATION_IMPORT =
    'VariableDeclaration:has(Identifier[name=withModuleFederationForSSR]) Identifier[name=withModuleFederationForSSR]';
  const withModuleFederationNodes = tsquery(ast, WITH_MODULE_FEDERATION_IMPORT);
  if (nodes.length === 0) {
    return;
  }

  const startIndex = withModuleFederationNodes[0].getStart();
  let endIndex = withModuleFederationNodes[0].getEnd();
  if (configContents.charAt(endIndex) === ',') {
    endIndex++;
  }

  const newContents = `const { withModuleFederationForSSR } = require('@nx/rspack/module-federation');
  ${configContents.slice(0, startIndex)}${configContents.slice(endIndex)}`;

  tree.write(configPath, newContents);
}
