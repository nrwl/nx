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

  // Expo SDK 55+ exposes Metro config via the `expo/metro-config` sub-export,
  // so `@expo/metro-config` should not be installed directly (expo-doctor flags
  // it). Older SDKs (53/54) still require the direct dependency.
  const usesExpoMetro = major(coerce(versions.expo) ?? '0.0.0') >= 55;

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
      ...(usesExpoMetro
        ? {}
        : { '@expo/metro-config': versions.expoMetroConfig }),
      '@expo/metro-runtime': versions.expoMetroRuntime,
      'react-native-svg-transformer': versions.reactNativeSvgTransformer,
      'react-native-svg': versions.reactNativeSvg,
    },
    devDependencies,
    undefined,
    true
  );
}
