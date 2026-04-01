import {
  addDependenciesToPackageJson,
  detectPackageManager,
  logger,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { coerce, major } from 'semver';
import {
  ajvVersion,
  analogVitestAngular,
  edgeRuntimeVmVersion,
  happyDomVersion,
  jsdomVersion,
  vitePluginDtsVersion,
  vitePluginReactSwcVersion,
  vitePluginReactV4Version,
  vitePluginReactVersion,
} from './versions';

export type EnsureDependenciesOptions = {
  uiFramework: 'angular' | 'react' | 'none';
  compiler?: 'babel' | 'swc';
  includeLib?: boolean;
  testEnvironment?: 'node' | 'jsdom' | 'happy-dom' | 'edge-runtime' | string;
};

export function ensureDependencies(
  host: Tree,
  schema: EnsureDependenciesOptions
): GeneratorCallback {
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
      // @vitejs/plugin-react v6 requires Vite 8+, use v4 for older versions
      const pkgJson = JSON.parse(host.read('package.json', 'utf-8'));
      const viteRange = pkgJson?.devDependencies?.['vite'];
      const viteMajor = viteRange ? major(coerce(viteRange)) : null;
      devDependencies['@vitejs/plugin-react'] =
        viteMajor !== null && viteMajor < 8
          ? vitePluginReactV4Version
          : vitePluginReactVersion;
    }
  }

  if (schema.includeLib) {
    devDependencies['vite-plugin-dts'] = vitePluginDtsVersion;
    if (detectPackageManager() !== 'pnpm') {
      devDependencies['ajv'] = ajvVersion;
    }
  }

  return addDependenciesToPackageJson(host, {}, devDependencies);
}
