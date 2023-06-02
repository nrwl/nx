import {
  joinPathFragments,
  names,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import type { Schema } from '../schema';
import { ArrayLiteralExpression } from 'typescript';
import { insertImport } from '@nx/js';
import { addRoute } from '../../../utils/nx-devkit/route-utils';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export function checkIsCommaNeeded(mfRemoteText: string) {
  const remoteText = mfRemoteText.replace(/\s+/g, '');
  return !remoteText.endsWith(',]')
    ? remoteText === '[]'
      ? false
      : true
    : false;
}

export function addRemoteToHost(tree: Tree, options: Schema) {
  if (options.host) {
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
      'remotes.d.ts'
    );

    const declarationFileContent =
      (tree.exists(declarationFilePath)
        ? tree.read(declarationFilePath, 'utf-8')
        : '') +
      `\ndeclare module '${options.appName}/${
        options.standalone ? `Routes` : `Module`
      }';`;
    tree.write(declarationFilePath, declarationFileContent);

    addLazyLoadedRouteToHostAppModule(tree, options, hostFederationType);
  }
}

function determineHostFederationType(
  tree: Tree,
  pathToMfManifest: string
): 'dynamic' | 'static' {
  return tree.exists(pathToMfManifest) ? 'dynamic' : 'static';
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
  const { tsquery } = require('@phenomnomnominal/tsquery');
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
  pathToMfManifest: string
) {
  updateJson(tree, pathToMfManifest, (manifest) => {
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
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const hostAppConfig = readProjectConfiguration(tree, options.host);

  const pathToHostRootRouting = `${hostAppConfig.sourceRoot}/app/app.routes.ts`;

  if (!tree.exists(pathToHostRootRouting)) {
    return;
  }

  const hostRootRoutingFile = tree.read(pathToHostRootRouting, 'utf-8');

  let sourceFile = tsModule.createSourceFile(
    pathToHostRootRouting,
    hostRootRoutingFile,
    tsModule.ScriptTarget.Latest,
    true
  );

  if (hostFederationType === 'dynamic') {
    sourceFile = insertImport(
      tree,
      sourceFile,
      pathToHostRootRouting,
      'loadRemoteModule',
      '@nx/angular/mf'
    );
  }

  const routePathName = options.standalone ? 'Routes' : 'Module';
  const exportedRemote = options.standalone
    ? 'remoteRoutes'
    : 'RemoteEntryModule';
  const routeToAdd =
    hostFederationType === 'dynamic'
      ? `loadRemoteModule('${options.appName}', './${routePathName}')`
      : `import('${options.appName}/${routePathName}')`;

  addRoute(
    tree,
    pathToHostRootRouting,
    `{
    path: '${options.appName}',
    loadChildren: () => ${routeToAdd}.then(m => m.${exportedRemote})
    }`
  );

  const pathToAppComponentTemplate = joinPathFragments(
    hostAppConfig.sourceRoot,
    'app/app.component.html'
  );
  const appComponent = tree.read(pathToAppComponentTemplate, 'utf-8');
  if (
    appComponent.includes(`<ul class="remote-menu">`) &&
    appComponent.includes('</ul>')
  ) {
    const indexOfClosingMenuTag = appComponent.indexOf('</ul>');
    const newAppComponent = `${appComponent.slice(
      0,
      indexOfClosingMenuTag
    )}<li><a routerLink='${options.appName}'>${
      names(options.appName).className
    }</a></li>\n${appComponent.slice(indexOfClosingMenuTag)}`;
    tree.write(pathToAppComponentTemplate, newAppComponent);
  }
}
