import {
  addDependenciesToPackageJson,
  detectPackageManager,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { coerce, major } from 'semver';
import { getExpoDependenciesVersionsToInstall } from './version-utils';
import { expoVectorIconsVersion } from './versions';

export async function ensureDependencies(
  host: Tree,
  unitTestRunner: 'jest' | 'none'
): Promise<GeneratorCallback> {
  const versions = await getExpoDependenciesVersionsToInstall(host);

  // Expo SDK 55+ ships Metro via `@expo/metro` and exposes its config through
  // the `expo/metro-config` sub-export, so `@expo/metro-config` should not be
  // installed directly (expo-doctor flags it). Instead `@expo/metro` must be a
  // direct dependency, because the generated `metro.config.js` and `withNxMetro`
  // require `@expo/metro/metro-config` — package managers like pnpm don't allow
  // requiring into transitive dependencies. Older SDKs (53/54) keep the
  // standalone `@expo/metro-config`.
  const usesExpoMetro = major(coerce(versions.expo) ?? '0.0.0') >= 55;
  const metroDeps: Record<string, string> = usesExpoMetro
    ? versions.expoMetro
      ? { '@expo/metro': versions.expoMetro }
      : {}
    : { '@expo/metro-config': versions.expoMetroConfig };

  const devDependencies: Record<string, string> = {
    '@types/react': versions.typesReact,
    'babel-preset-expo': versions.babelPresetExpo,
  };

  const isPnpm = detectPackageManager(host.root) === 'pnpm';
  if (isPnpm) {
    devDependencies['@babel/runtime'] = versions.babelRuntime; // @babel/runtime is used by react-native-svg
  }

  if (unitTestRunner === 'jest') {
    devDependencies['@testing-library/react-native'] =
      versions.testingLibraryReactNative;
    devDependencies['react-test-renderer'] = versions.reactTestRenderer;
    devDependencies['jest-expo'] = versions.jestExpo;
  }

  return addDependenciesToPackageJson(
    host,
    {
      '@expo/vector-icons': expoVectorIconsVersion,
      'expo-splash-screen': versions.expoSplashScreen,
      'expo-status-bar': versions.expoStatusBar,
      'expo-system-ui': versions.expoSystemUi,
      'react-native-web': versions.reactNativeWeb,
      ...metroDeps,
      '@expo/metro-runtime': versions.expoMetroRuntime,
      'react-native-svg-transformer': versions.reactNativeSvgTransformer,
      'react-native-svg': versions.reactNativeSvg,
    },
    devDependencies,
    undefined,
    true
  );
}
