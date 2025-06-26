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

export function ensureDependencies(host: Tree): GeneratorCallback {
  const isPnpm = detectPackageManager(host.root) === 'pnpm';
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
    {
      '@types/react': typesReactVersion,
      '@testing-library/react-native': testingLibraryReactNativeVersion,
      'jest-expo': jestExpoVersion,
      'babel-preset-expo': babelPresetExpoVersion,
      ...(isPnpm
        ? {
            '@babel/runtime': babelRuntimeVersion, // @babel/runtime is used by react-native-svg
          }
        : {}),
    }
  );
}
