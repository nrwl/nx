import { processRuntimeRemoteUrl } from './url-helpers';

export type ResolveRemoteUrlFunction = (
  remoteName: string
) => string | Promise<string>;

declare const __webpack_init_sharing__: (scope: 'default') => Promise<void>;
declare const __webpack_share_scopes__: { default: unknown };

let resolveRemoteUrl: ResolveRemoteUrlFunction;

/**
 * @deprecated Use Runtime Helpers from '@module-federation/enhanced/runtime' instead. This will be removed in Nx 22.
 */
export function setRemoteUrlResolver(
  _resolveRemoteUrl: ResolveRemoteUrlFunction
) {
  resolveRemoteUrl = _resolveRemoteUrl;
}

let remoteUrlDefinitions: Record<string, string>;

/**
 * @deprecated Use init() from '@module-federation/enhanced/runtime' instead. This will be removed in Nx 22.
 * If you have a remote app called `my-remote-app` and you want to use the `http://localhost:4201/mf-manifest.json` as the remote url, you should change it from:
 * ```ts
 * import { setRemoteDefinitions } from '@nx/angular/mf';
 *
 * setRemoteDefinitions({
 *   'my-remote-app': 'http://localhost:4201/mf-manifest.json'
 * });
 * ```
 * to use init():
 * ```ts
 * import { init } from '@module-federation/enhanced/runtime';
 *
 * init({
 *   name: 'host',
 *   remotes: [{
 *     name: 'my-remote-app',
 *     entry: 'http://localhost:4201/mf-manifest.json'
 *   }]
 * });
 * ```
 */
export function setRemoteDefinitions(definitions: Record<string, string>) {
  remoteUrlDefinitions = definitions;
}

/**
 * @deprecated Use registerRemotes() from '@module-federation/enhanced/runtime' instead. This will be removed in Nx 22.
 * If you set a remote app with `setRemoteDefinition` such as:
 * ```ts
 * import { setRemoteDefinition } from '@nx/angular/mf';
 *
 * setRemoteDefinition(
 *   'my-remote-app',
 *   'http://localhost:4201/mf-manifest.json'
 * );
 * ```
 * change it to use registerRemotes():
 * ```ts
 * import { registerRemotes } from '@module-federation/enhanced/runtime';
 *
 * registerRemotes([
 *  {
 *     name: 'my-remote-app',
 *     entry: 'http://localhost:4201/mf-manifest.json'
 *   }
 * ]);
 * ```
 */
export function setRemoteDefinition(remoteName: string, remoteUrl: string) {
  remoteUrlDefinitions ??= {};
  remoteUrlDefinitions[remoteName] = remoteUrl;
}

let remoteModuleMap = new Map<string, unknown>();
let remoteContainerMap = new Map<string, unknown>();

/**
 * @deprecated Use loadRemote() from '@module-federation/enhanced/runtime' instead. This will be removed in Nx 22.
 * If you set a load a remote with `loadRemoteModule` such as:
 * ```ts
 * import { loadRemoteModule } from '@nx/angular/mf';
 *
 * loadRemoteModule('my-remote-app', './Module').then(m => m.RemoteEntryModule);
 * ```
 * change it to use loadRemote():
 * ```ts
 * import { loadRemote } from '@module-federation/enhanced/runtime';
 *
 * loadRemote<typeof import('my-remote-app/Module')>('my-remote-app/Module').then(m => m.RemoteEntryModule);
 * ```
 */
export async function loadRemoteModule(remoteName: string, moduleName: string) {
  const remoteModuleKey = `${remoteName}:${moduleName}`;
  if (remoteModuleMap.has(remoteModuleKey)) {
    return remoteModuleMap.get(remoteModuleKey);
  }

  const container = remoteContainerMap.has(remoteName)
    ? remoteContainerMap.get(remoteName)
    : await loadRemoteContainer(remoteName);

  const factory = await container.get(moduleName);
  const Module = factory();

  remoteModuleMap.set(remoteModuleKey, Module);

  return Module;
}

function loadModule(url: string) {
  return import(/* webpackIgnore:true */ url);
}

let initialSharingScopeCreated = false;

async function loadRemoteContainer(remoteName: string) {
  if (!resolveRemoteUrl && !remoteUrlDefinitions) {
    throw new Error(
      'Call setRemoteDefinitions or setRemoteUrlResolver to allow Dynamic Federation to find the remote apps correctly.'
    );
  }

  if (!initialSharingScopeCreated) {
    initialSharingScopeCreated = true;
    await __webpack_init_sharing__('default');
  }

  const remoteUrl = remoteUrlDefinitions
    ? remoteUrlDefinitions[remoteName]
    : await resolveRemoteUrl(remoteName);

  const containerUrl = processRuntimeRemoteUrl(remoteUrl, 'mjs');

  const container = await loadModule(containerUrl);
  await container.init(__webpack_share_scopes__.default);

  remoteContainerMap.set(remoteName, container);
  return container;
}
