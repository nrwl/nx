export type ResolveRemoteUrlFunction = (
  remoteName: string
) => string | Promise<string>;

declare const window: {
  [key: string]: any;
};

declare const document: {
  head: {
    appendChild: (script: HTMLScriptElement) => void;
  };
  createElement: (type: 'script') => any;
};

declare const __webpack_init_sharing__: (scope: 'default') => Promise<void>;
declare const __webpack_share_scopes__: { default: unknown };
let remoteUrlDefinitions: Record<string, string> = {};
let resolveRemoteUrl: ResolveRemoteUrlFunction;
const remoteModuleMap = new Map<string, unknown>();
const remoteContainerMap = new Map<string, unknown>();
let initialSharingScopeCreated = false;

export function setRemoteUrlResolver(
  _resolveRemoteUrl: ResolveRemoteUrlFunction
) {
  resolveRemoteUrl = _resolveRemoteUrl;
}

export function setRemoteDefinitions(definitions: Record<string, string>) {
  remoteUrlDefinitions = definitions;
}

export function setRemoteDefinition(remoteName: string, remoteUrl: string) {
  remoteUrlDefinitions[remoteName] = remoteUrl;
}

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

const fetchRemoteModule = (url: string, remoteName: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;
    script.type = 'text/javascript';
    script.async = true;
    script.onload = () => {
      const proxy = {
        get: (request) => window[remoteName].get(request),
        init: (arg) => {
          try {
            window[remoteName].init(arg);
          } catch (e) {
            console.error(`Failed to initialize remote ${remoteName}`, e);
            reject(e);
          }
        },
      };
      resolve(proxy);
    };
    script.onerror = () => reject(new Error(`Remote ${remoteName} not found`));
    document.head.appendChild(script);
  });
};

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

  let containerUrl = remoteUrl;
  if (!remoteUrl.endsWith('.mjs') && !remoteUrl.endsWith('.js')) {
    containerUrl = `${remoteUrl}${
      remoteUrl.endsWith('/') ? '' : '/'
    }remoteEntry.js`;
  }

  const container = await fetchRemoteModule(containerUrl, remoteName);
  await container.init(__webpack_share_scopes__.default);

  remoteContainerMap.set(remoteName, container);
  return container;
}
