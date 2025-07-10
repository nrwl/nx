import {
  addDependenciesToPackageJson,
  detectPackageManager,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import {
  babelPresetExpoVersion,
  babelRuntimeVersion,
  expoMetroConfigVersion,
  expoMetroRuntimeVersion,
  expoSplashScreenVersion,
  expoStatusBarVersion,
  expoSystemUiVersion,
  jestExpoVersion,
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  reactNativeWebVersion,
  testingLibraryReactNativeVersion,
  typesReactVersion,
} from './versions';

export function ensureDependencies(
  host: Tree,
  unitTestRunner: 'jest' | 'none'
): GeneratorCallback {
  const devDependencies: Record<string, string> = {
    '@types/react': typesReactVersion,
    'babel-preset-expo': babelPresetExpoVersion,
  };

  const isPnpm = detectPackageManager(host.root) === 'pnpm';
  if (isPnpm) {
    devDependencies['@babel/runtime'] = babelRuntimeVersion; // @babel/runtime is used by react-native-svg
  }

  if (unitTestRunner === 'jest') {
    devDependencies['@testing-library/react-native'] =
      testingLibraryReactNativeVersion;
    devDependencies['jest-expo'] = jestExpoVersion;
  }

  return addDependenciesToPackageJson(
    host,
    {
      'expo-splash-screen': expoSplashScreenVersion,
      'expo-status-bar': expoStatusBarVersion,
      'expo-system-ui': expoSystemUiVersion,
      'react-native-web': reactNativeWebVersion,
      '@expo/metro-config': expoMetroConfigVersion,
      '@expo/metro-runtime': expoMetroRuntimeVersion,
      'react-native-svg-transformer': reactNativeSvgTransformerVersion,
      'react-native-svg': reactNativeSvgVersion,
    },
    devDependencies
  );
}
