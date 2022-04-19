import { ProjectConfiguration, Tree, updateJson } from '@nrwl/devkit';
import type { Schema } from '../schema';

import { readProjectConfiguration, joinPathFragments } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { ArrayLiteralExpression } from 'typescript';
import {
  addImportToModule,
  addRoute,
} from '../../../utils/nx-devkit/ast-utils';

import * as ts from 'typescript';
import { insertImport } from '@nrwl/workspace/src/utilities/ast-utils';

export function checkIsCommaNeeded(mfeRemoteText: string) {
  const remoteText = mfeRemoteText.replace(/\s+/g, '');
  return !remoteText.endsWith(',]')
    ? remoteText === '[]'
      ? false
      : true
    : false;
}

export function addRemoteToHost(tree: Tree, options: Schema) {
  if (options.mfeType === 'remote' && options.host) {
    const hostProject = readProjectConfiguration(tree, options.host);
    const pathToMFManifest = joinPathFragments(
      hostProject.sourceRoot,
      'assets/module-federation.manifest.json'
    );
    const hostFederationType = determineHostFederationType(
      tree,
      pathToMFManifest
    );

    if (hostFederationType === 'static') {
      addRemoteToStaticHost(tree, options, hostProject);
    } else if (hostFederationType === 'dynamic') {
      addRemoteToDynamicHost(tree, options, pathToMFManifest);
    }

    const declarationFilePath = joinPathFragments(
      hostProject.sourceRoot,
      'decl.d.ts'
    );

    const declarationFileContent =
      (tree.exists(declarationFilePath)
        ? tree.read(declarationFilePath, 'utf-8')
        : '') + `\ndeclare module '${options.appName}/Module';`;
    tree.write(declarationFilePath, declarationFileContent);

    addLazyLoadedRouteToHostAppModule(tree, options, hostFederationType);
  }
}

function determineHostFederationType(
  tree: Tree,
  pathToMfeManifest: string
): 'dynamic' | 'static' {
  return tree.exists(pathToMfeManifest) ? 'dynamic' : 'static';
}

function addRemoteToStaticHost(
  tree: Tree,
  options: Schema,
  hostProject: ProjectConfiguration
) {
  const hostMFConfigPath = joinPathFragments(
    hostProject.root,
    'module-federation.config.js'
  );

  if (!hostMFConfigPath || !tree.exists(hostMFConfigPath)) {
    throw new Error(
      `The selected host application, ${options.host}, does not contain a module-federation.config.js or module-federation.manifest.json file. Are you sure it has been set up as a host application?`
    );
  }

  const hostMFConfig = tree.read(hostMFConfigPath, 'utf-8');
  const webpackAst = tsquery.ast(hostMFConfig);
  const mfRemotesNode = tsquery(
    webpackAst,
    'Identifier[name=remotes] ~ ArrayLiteralExpression',
    { visitAllChildren: true }
  )[0] as ArrayLiteralExpression;

  const endOfPropertiesPos = mfRemotesNode.getEnd() - 1;
  const isCommaNeeded = checkIsCommaNeeded(mfRemotesNode.getText());

  const updatedConfig = `${hostMFConfig.slice(0, endOfPropertiesPos)}${
    isCommaNeeded ? ',' : ''
  }'${options.appName}',${hostMFConfig.slice(endOfPropertiesPos)}`;

  tree.write(hostMFConfigPath, updatedConfig);
}

function addRemoteToDynamicHost(
  tree: Tree,
  options: Schema,
  pathToMfeManifest: string
) {
  updateJson(tree, pathToMfeManifest, (manifest) => {
    return {
      ...manifest,
      [options.appName]: `http://localhost:${options.port}`,
    };
  });
}

// TODO(colum): future work: allow dev to pass to path to routing module
function addLazyLoadedRouteToHostAppModule(
  tree: Tree,
  options: Schema,
  hostFederationType: 'dynamic' | 'static'
) {
  const hostAppConfig = readProjectConfiguration(tree, options.host);
  const pathToHostAppModule = `${hostAppConfig.sourceRoot}/app/app.module.ts`;
  if (!tree.exists(pathToHostAppModule)) {
    return;
  }

  const hostAppModule = tree.read(pathToHostAppModule, 'utf-8');
  if (!hostAppModule.includes('RouterModule.forRoot(')) {
    return;
  }

  let sourceFile = ts.createSourceFile(
    pathToHostAppModule,
    hostAppModule,
    ts.ScriptTarget.Latest,
    true
  );

  if (hostFederationType === 'dynamic') {
    sourceFile = insertImport(
      tree,
      sourceFile,
      pathToHostAppModule,
      'loadRemoteModule',
      '@nrwl/angular/mfe'
    );
  }
  const routeToAdd =
    hostFederationType === 'dynamic'
      ? `loadRemoteModule('${options.appName}', './Module')`
      : `import('${options.appName}/Module')`;

  sourceFile = addRoute(
    tree,
    pathToHostAppModule,
    sourceFile,
    `{
         path: '${options.appName}', 
         loadChildren: () => ${routeToAdd}.then(m => m.RemoteEntryModule)
     }`
  );
}
