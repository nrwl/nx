import type { FederationRuntimePlugin } from '@module-federation/enhanced/runtime';

const runtimeStore: {
  name?: string;
  devRemotes?: string[];
  sharedPackagesFromDev: Record<string, string>;
} = {
  sharedPackagesFromDev: {},
};

if (process.env.NX_MF_DEV_REMOTES) {
  // process.env.NX_MF_DEV_REMOTES is replaced by an array value via DefinePlugin, even though the original value is a stringified array.
  runtimeStore.devRemotes = process.env
    .NX_MF_DEV_REMOTES as unknown as string[];
}

const nxRuntimeLibraryControlPlugin: () => FederationRuntimePlugin =
  function () {
    return {
      name: 'nx-runtime-library-control-plugin',
      beforeInit(args) {
        runtimeStore.name = args.options.name;
        return args;
      },
      resolveShare: (args) => {
        const { shareScopeMap, scope, pkgName, version, GlobalFederation } =
          args;

        const originalResolver = args.resolver;
        args.resolver = function () {
          if (!runtimeStore.sharedPackagesFromDev[pkgName]) {
            if (!GlobalFederation.__INSTANCES__) {
              return originalResolver();
            } else if (!runtimeStore.devRemotes) {
              return originalResolver();
            }
            const devRemoteInstanceToUse = GlobalFederation.__INSTANCES__.find(
              (instance) =>
                instance.options.shared[pkgName] &&
                runtimeStore.devRemotes.find((dr) => instance.name === dr)
            );
            if (!devRemoteInstanceToUse) {
              return originalResolver();
            }
            runtimeStore.sharedPackagesFromDev[pkgName] =
              devRemoteInstanceToUse.name;
          }

          const remoteInstanceName =
            runtimeStore.sharedPackagesFromDev[pkgName];
          const remoteInstance = GlobalFederation.__INSTANCES__.find(
            (instance) => instance.name === remoteInstanceName
          );
          try {
            const remotePkgInfo = remoteInstance.options.shared[pkgName].find(
              (shared) => shared.from === remoteInstanceName
            );
            remotePkgInfo.useIn.push(runtimeStore.name);
            remotePkgInfo.useIn = Array.from(new Set(remotePkgInfo.useIn));
            shareScopeMap[scope][pkgName][version] = remotePkgInfo;
            return remotePkgInfo;
          } catch {
            return originalResolver();
          }
        };
        return args;
      },
    };
  };

export default nxRuntimeLibraryControlPlugin;
