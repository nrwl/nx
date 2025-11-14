export type ResolveRemoteUrlFunction = (
  remoteName: string
) => string | Promise<string>;
/**
 * @deprecated Use Runtime Helpers from '@module-federation/enhanced/runtime' instead. This will be removed in Nx 22.
 */
export declare function setRemoteUrlResolver(
  _resolveRemoteUrl: ResolveRemoteUrlFunction
): void;
/**
 * @deprecated Use init() from '@module-federation/enhanced/runtime' instead. This will be removed in Nx 22.
 * If you have a remote app called `my-remote-app` and you want to use the `http://localhost:4201/mf-manifest.json` as the remote url, you should change it from:
 * ```ts
 * import { setRemoteDefinitions } from '@nx/react/mf';
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
export declare function setRemoteDefinitions(
  definitions: Record<string, string>
): void;
/**
 * @deprecated Use registerRemotes() from '@module-federation/enhanced/runtime' instead. This will be removed in Nx 22.
 * If you set a remote app with `setRemoteDefinition` such as:
 * ```ts
 * import { setRemoteDefinition } from '@nx/react/mf';
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
export declare function setRemoteDefinition(
  remoteName: string,
  remoteUrl: string
): void;
/**
 * @deprecated Use loadRemote() from '@module-federation/enhanced/runtime' instead. This will be removed in Nx 22.
 * If you set a load a remote with `loadRemoteModule` such as:
 * ```ts
 * import { loadRemoteModule } from '@nx/react/mf';
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
export declare function loadRemoteModule(
  remoteName: string,
  moduleName: string
): Promise<any>;
//# sourceMappingURL=dynamic-federation.d.ts.map
