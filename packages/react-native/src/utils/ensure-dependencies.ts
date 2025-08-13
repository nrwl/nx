import {
  addDependenciesToPackageJson,
  detectPackageManager,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import {
  babelCoreVersion,
  babelPresetReactVersion,
} from '@nx/react/src/utils/versions';
import {
  babelRuntimeVersion,
  reactNativeBabelPresetVersion,
  reactNativeCommunityCliVersion,
  reactNativeCommunityCliPlatformAndroidVersion,
  reactNativeCommunityCliPlatformIosVersion,
  reactNativeMetroConfigVersion,
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  reactTestRendererVersion,
  testingLibraryReactNativeVersion,
  typesNodeVersion,
  typesReactVersion,
} from './versions';

export function ensureDependencies(
  tree: Tree,
  unitTestRunner?: 'jest' | 'none'
): GeneratorCallback {
  const isPnpm = detectPackageManager(tree.root) === 'pnpm';

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@types/node': typesNodeVersion,
      '@types/react': typesReactVersion,
      '@react-native/babel-preset': reactNativeBabelPresetVersion,
      '@react-native/metro-config': reactNativeMetroConfigVersion,
      '@react-native-community/cli': reactNativeCommunityCliVersion,
      '@react-native-community/cli-platform-android':
        reactNativeCommunityCliPlatformAndroidVersion,
      '@react-native-community/cli-platform-ios':
        reactNativeCommunityCliPlatformIosVersion,
      'react-native-svg-transformer': reactNativeSvgTransformerVersion,
      'react-native-svg': reactNativeSvgVersion,
      '@babel/preset-react': babelPresetReactVersion,
      '@babel/core': babelCoreVersion,
      ...(unitTestRunner === 'jest'
        ? {
            '@testing-library/react-native': testingLibraryReactNativeVersion,
            'react-test-renderer': reactTestRendererVersion,
          }
        : {}),
      ...(isPnpm
        ? {
            '@babel/runtime': babelRuntimeVersion, // @babel/runtime is used by react-native-svg
          }
        : {}),
    }
  );
}
