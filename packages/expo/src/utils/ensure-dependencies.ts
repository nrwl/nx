import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  type Tree,
} from '@nx/devkit';
import {
  babelPresetExpoVersion,
  expoMetroConfigVersion,
  expoSplashScreenVersion,
  expoStatusBarVersion,
  jestExpoVersion,
  metroVersion,
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  reactNativeWebVersion,
  reactTestRendererVersion,
  testingLibraryJestNativeVersion,
  testingLibraryReactNativeVersion,
  typesReactVersion,
} from './versions';

export function ensureDependencies(host: Tree): GeneratorCallback {
  return addDependenciesToPackageJson(
    host,
    {
      'expo-splash-screen': expoSplashScreenVersion,
      'expo-status-bar': expoStatusBarVersion,
      'react-native-web': reactNativeWebVersion,
      '@expo/metro-config': expoMetroConfigVersion,
      'react-native-svg-transformer': reactNativeSvgTransformerVersion,
      'react-native-svg': reactNativeSvgVersion,
    },
    {
      '@types/react': typesReactVersion,
      metro: metroVersion,
      'metro-resolver': metroVersion,
      'react-test-renderer': reactTestRendererVersion,
      '@testing-library/react-native': testingLibraryReactNativeVersion,
      '@testing-library/jest-native': testingLibraryJestNativeVersion,
      'jest-expo': jestExpoVersion,
      'babel-preset-expo': babelPresetExpoVersion,
    }
  );
}
