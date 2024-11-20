import {
  joinPathFragments,
  names,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
} from '@nx/devkit';
import { ArrayLiteralExpression } from 'typescript';
import { insertImport } from '@nx/js';
import { addRoute } from '../../../utils/nx-devkit/route-utils';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export type AddRemoteOptions = {
  host: string;
  appName: string;
  standalone: boolean;
  port: number;
};

export function checkIsCommaNeeded(mfRemoteText: string) {
  const remoteText = mfRemoteText.replace(/\s+/g, '');
  return !remoteText.endsWith(',]')
    ? remoteText === '[]'
      ? false
      : true
    : false;
}

export function addRemoteToHost(tree: Tree, options: AddRemoteOptions) {
  if (options.host) {
    const hostProject = readProjectConfiguration(tree, options.host);
    const pathToMFManifest = getDynamicManifestFile(tree, hostProject);
    const hostFederationType = !!pathToMFManifest ? 'dynamic' : 'static';

    const isHostUsingTypescriptConfig = tree.exists(
      joinPathFragments(hostProject.root, 'module-federation.config.ts')
    );

    if (hostFederationType === 'static') {
      addRemoteToStaticHost(
        tree,
        options,
        hostProject,
        isHostUsingTypescriptConfig
      );
    } else if (hostFederationType === 'dynamic') {
      addRemoteToDynamicHost(
        tree,
        options,
        pathToMFManifest,
        hostProject.sourceRoot
      );
    }

    addLazyLoadedRouteToHostAppModule(tree, options, hostFederationType);
  }
}

function getDynamicManifestFile(
  tree: Tree,
  project: ProjectConfiguration
): string | undefined {
  // {sourceRoot}/assets/module-federation.manifest.json was the generated
  // path for the manifest file in the past. We now generate the manifest
  // file at {root}/public/module-federation.manifest.json. This check
  // ensures that we can still support the old path for backwards
  // compatibility since old projects may still have the manifest file
  // at the old path.
  return [
    joinPathFragments(project.root, 'public/module-federation.manifest.json'),
    joinPathFragments(
      project.sourceRoot,
      'assets/module-federation.manifest.json'
    ),
  ].find((path) => tree.exists(path));
}

function addRemoteToStaticHost(
  tree: Tree,
  options: AddRemoteOptions,
  hostProject: ProjectConfiguration,
  isHostUsingTypescript: boolean
) {
  const hostMFConfigPath = joinPathFragments(
    hostProject.root,
    isHostUsingTypescript
      ? 'module-federation.config.ts'
      : 'module-federation.config.js'
  );

  if (!hostMFConfigPath || !tree.exists(hostMFConfigPath)) {
    throw new Error(
      `The selected host application, ${options.host}, does not contain a module-federation.config.{ts,js} or module-federation.manifest.json file. Are you sure it has been set up as a host application?`
    );
  }

  const hostMFConfig = tree.read(hostMFConfigPath, 'utf-8');
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const webpackAst = tsquery.ast(hostMFConfig);
  const mfRemotesNode = tsquery(
    webpackAst,
    'ObjectLiteralExpression > PropertyAssignment:has(Identifier[name=remotes]) > ArrayLiteralExpression',
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
  options: AddRemoteOptions,
  pathToMfManifest: string,
  hostSourceRoot: string
) {
  // TODO(Colum): Remove for Nx 22
  const usingLegacyDynamicFederation = tree
    .read(`${hostSourceRoot}/main.ts`, 'utf-8')
    .includes('setRemoteDefinitions(');
  updateJson(tree, pathToMfManifest, (manifest) => {
    return {
      ...manifest,
      [options.appName]: `http://localhost:${options.port}${
        usingLegacyDynamicFederation ? '' : '/mf-manifest.json'
      }`,
    };
  });
}

function addLazyLoadedRouteToHostAppModule(
  tree: Tree,
  options: AddRemoteOptions,
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

  // TODO(Colum): Remove for Nx 22
  const usingLegacyDynamicFederation =
    hostFederationType === 'dynamic' &&
    tree
      .read(`${hostAppConfig.sourceRoot}/main.ts`, 'utf-8')
      .includes('setRemoteDefinitions(');

  if (hostFederationType === 'dynamic') {
    sourceFile = insertImport(
      tree,
      sourceFile,
      pathToHostRootRouting,
      usingLegacyDynamicFederation ? 'loadRemoteModule' : 'loadRemote',
      usingLegacyDynamicFederation
        ? '@nx/angular/mf'
        : '@module-federation/enhanced/runtime'
    );
  }

  const routePathName = options.standalone ? 'Routes' : 'Module';
  const exportedRemote = options.standalone
    ? 'remoteRoutes'
    : 'RemoteEntryModule';
  const remoteModulePath = `${options.appName.replace(
    /-/g,
    '_'
  )}/${routePathName}`;
  const routeToAdd =
    hostFederationType === 'dynamic'
      ? usingLegacyDynamicFederation
        ? `loadRemoteModule('${options.appName.replace(
            /-/g,
            '_'
          )}', './${routePathName}')`
        : `loadRemote<typeof import('${remoteModulePath}')>('${remoteModulePath}')`
      : `import('${remoteModulePath}')`;

  addRoute(
    tree,
    pathToHostRootRouting,
    `{
    path: '${options.appName}',
    loadChildren: () => ${routeToAdd}.then(m => m!.${exportedRemote})
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
    )}<li><a routerLink="${options.appName}">${
      names(options.appName).className
    }</a></li>\n${appComponent.slice(indexOfClosingMenuTag)}`;
    tree.write(pathToAppComponentTemplate, newAppComponent);
  }
}
