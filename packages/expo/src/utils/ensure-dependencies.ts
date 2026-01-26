import {
  addDependenciesToPackageJson,
  detectPackageManager,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import { getExpoDependenciesVersionsToInstall } from './version-utils';

export async function ensureDependencies(
  host: Tree,
  unitTestRunner: 'jest' | 'none'
): Promise<GeneratorCallback> {
  const versions = await getExpoDependenciesVersionsToInstall(host);

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
    devDependencies['jest-expo'] = versions.jestExpo;
  }

  return addDependenciesToPackageJson(
    host,
    {
      'expo-splash-screen': versions.expoSplashScreen,
      'expo-status-bar': versions.expoStatusBar,
      'expo-system-ui': versions.expoSystemUi,
      'react-native-web': versions.reactNativeWeb,
      '@expo/metro-config': versions.expoMetroConfig,
      '@expo/metro-runtime': versions.expoMetroRuntime,
      'react-native-svg-transformer': versions.reactNativeSvgTransformer,
      'react-native-svg': versions.reactNativeSvg,
    },
    devDependencies
  );
}
