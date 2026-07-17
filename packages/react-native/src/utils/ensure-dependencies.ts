import {
  addDependenciesToPackageJson,
  detectPackageManager,
  GeneratorCallback,
  Tree,
} from '@nx/devkit';
import { babelCoreVersion, babelPresetReactVersion } from '@nx/react/internal';
import {
  babelRuntimeVersion,
  reactNativeSvgTransformerVersion,
  reactNativeSvgVersion,
  reactTestRendererVersion,
  testingLibraryReactNativeVersion,
  typesNodeVersion,
  typesReactVersion,
  versions,
} from './versions';

export function ensureDependencies(
  tree: Tree,
  unitTestRunner?: 'jest' | 'none'
): GeneratorCallback {
  const isPnpm = detectPackageManager(tree.root) === 'pnpm';
  const rnVersions = versions(tree);

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@types/node': typesNodeVersion,
      '@types/react': typesReactVersion,
      '@react-native/babel-preset': rnVersions.reactNativeBabelPresetVersion,
      '@react-native/metro-config': rnVersions.reactNativeMetroConfigVersion,
      '@react-native-community/cli': rnVersions.reactNativeCommunityCliVersion,
      '@react-native-community/cli-platform-android':
        rnVersions.reactNativeCommunityCliPlatformAndroidVersion,
      '@react-native-community/cli-platform-ios':
        rnVersions.reactNativeCommunityCliPlatformIosVersion,
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
    },
    undefined,
    true
  );
}
