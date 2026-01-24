import {
  addDependenciesToPackageJson,
  detectPackageManager,
  logger,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import {
  ajvVersion,
  analogVitestAngular,
  edgeRuntimeVmVersion,
  happyDomVersion,
  jsdomVersion,
  vitePluginDtsVersion,
  vitePluginReactSwcVersion,
  vitePluginReactVersion,
} from './versions';
import { getVitestDependenciesVersionsToInstall } from './version-utils';

export type EnsureDependenciesOptions = {
  uiFramework: 'angular' | 'react' | 'vue' | 'none';
  compiler?: 'babel' | 'swc';
  includeLib?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string;
};

export async function ensureDependencies(
  tree: Tree,
  schema: EnsureDependenciesOptions
): Promise<GeneratorCallback> {
  const useVitestUi =
    schema.uiFramework === 'angular' ||
    schema.uiFramework === 'react' ||
    schema.uiFramework === 'vue';
  const devDependencies: Record<string, string> = {};

  if (schema.testEnvironment === 'jsdom') {
    devDependencies['jsdom'] = jsdomVersion;
  } else if (schema.testEnvironment === 'happy-dom') {
    devDependencies['happy-dom'] = happyDomVersion;
  } else if (schema.testEnvironment === 'edge-runtime') {
    devDependencies['@edge-runtime/vm'] = edgeRuntimeVmVersion;
  } else if (schema.testEnvironment !== 'node' && schema.testEnvironment) {
    logger.info(
      `A custom environment was provided: ${schema.testEnvironment}. You need to install it manually.`
    );
  }

  if (schema.uiFramework === 'angular') {
    devDependencies['@analogjs/vitest-angular'] = analogVitestAngular;
    devDependencies['@analogjs/vite-plugin-angular'] = analogVitestAngular;
  }

  if (schema.uiFramework === 'react') {
    if (schema.compiler === 'swc') {
      devDependencies['@vitejs/plugin-react-swc'] = vitePluginReactSwcVersion;
    } else {
      devDependencies['@vitejs/plugin-react'] = vitePluginReactVersion;
    }
  }

  if (schema.includeLib) {
    devDependencies['vite-plugin-dts'] = vitePluginDtsVersion;
    if (detectPackageManager() !== 'pnpm') {
      devDependencies['ajv'] = ajvVersion;
    }
  }

  if (useVitestUi) {
    const { vitestUi } = await getVitestDependenciesVersionsToInstall(tree);
    devDependencies['@vitest/ui'] = vitestUi;
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    devDependencies,
    undefined,
    true
  );
}
