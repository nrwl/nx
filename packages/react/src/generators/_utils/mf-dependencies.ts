import * as mfVersions from './mf-versions';
import { typescriptVersion } from '@nx/js/src/utils/versions';
import {
  reactVersion,
  reactDomVersion,
  typesReactVersion,
  typesReactDomVersion,
} from '../../utils/versions';
import type { SupportedBundler } from './normalize';

export interface DepsBundle {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

// Returned to both surfaces:
// - addDependenciesToPackageJson(tree, deps, devDeps) writes to root package.json
//   so bare `vite` / `rsbuild` / `rspack` in the run-commands serve target resolve
//   in integrated workspaces.
// - The per-project package.json template uses the same map so a pnpm-workspace
//   setup (which installs per-project) gets the same versions without drift.
export function getProviderDeps(bundler: SupportedBundler): DepsBundle {
  const base = {
    dependencies: {
      react: reactVersion,
      'react-dom': reactDomVersion,
    },
    devDependencies: {
      '@types/react': typesReactVersion,
      '@types/react-dom': typesReactDomVersion,
      typescript: typescriptVersion,
    },
  };
  return mergeWith(base, bundlerDeps(bundler));
}

export function getConsumerDeps(bundler: SupportedBundler): DepsBundle {
  const base = {
    dependencies: {
      '@module-federation/runtime': mfVersions.moduleFederationRuntimeVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
    },
    devDependencies: {
      '@types/react': typesReactVersion,
      '@types/react-dom': typesReactDomVersion,
      typescript: typescriptVersion,
    },
  };
  return mergeWith(base, bundlerDeps(bundler));
}

function bundlerDeps(bundler: SupportedBundler): DepsBundle {
  switch (bundler) {
    case 'vite':
      return {
        dependencies: {},
        devDependencies: {
          '@module-federation/vite':
            mfVersions.moduleFederationVitePluginVersion,
          '@vitejs/plugin-react': mfVersions.vitejsPluginReactVersion,
          vite: mfVersions.viteVersion,
        },
      };
    case 'rsbuild':
      return {
        dependencies: {},
        devDependencies: {
          '@module-federation/rsbuild-plugin':
            mfVersions.moduleFederationRsbuildPluginVersion,
          '@rsbuild/core': mfVersions.rsbuildCoreVersion,
          '@rsbuild/plugin-react': mfVersions.rsbuildPluginReactVersion,
        },
      };
    case 'rspack':
      // Rspack provider/consumer both put @module-federation/enhanced in
      // dependencies (it's imported at runtime by the federation plugin call).
      return {
        dependencies: {
          '@module-federation/enhanced':
            mfVersions.moduleFederationEnhancedVersion,
        },
        devDependencies: {
          '@rspack/cli': mfVersions.rspackCliVersion,
          '@rspack/core': mfVersions.rspackCoreVersion,
          '@rspack/dev-server': mfVersions.rspackDevServerVersion,
        },
      };
  }
}

function mergeWith(a: DepsBundle, b: DepsBundle): DepsBundle {
  return {
    dependencies: { ...a.dependencies, ...b.dependencies },
    devDependencies: { ...a.devDependencies, ...b.devDependencies },
  };
}
