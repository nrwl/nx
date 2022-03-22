export type ResolveRemoteUrlFunction = (
  remoteName: string
) => string | Promise<string>;

declare const __webpack_init_sharing__: (scope: 'default') => Promise<void>;
declare const __webpack_share_scopes__: { default: unknown };

let resolveRemoteUrl: ResolveRemoteUrlFunction;
export function setRemoteUrlResolver(
  _resolveRemoteUrl: ResolveRemoteUrlFunction
) {
  resolveRemoteUrl = _resolveRemoteUrl;
}

let remoteUrlDefinitions: Record<string, string>;
export function setRemoteDefinitions(definitions: Record<string, string>) {
  remoteUrlDefinitions = definitions;
}

let remoteModuleMap = new Map<string, unknown>();
let remoteContainerMap = new Map<string, unknown>();
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

  const containerUrl = `${remoteUrl}${
    remoteUrl.endsWith('/') ? '' : '/'
  }remoteEntry.mjs`;

  const container = await loadModule(containerUrl);
  await container.init(__webpack_share_scopes__.default);

  remoteContainerMap.set(remoteName, container);
  return container;
}
