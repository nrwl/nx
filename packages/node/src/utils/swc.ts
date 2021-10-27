import { addDependenciesToPackageJson, Tree } from '@nrwl/devkit';
import {
  swcCliVersion,
  swcCoreVersion,
  swcHelpersVersion,
  swcLoaderVersion,
} from './versions';

export function getSwcRuleLoader(): {
  loader: string;
} {
  try {
    // Do not need to check if swc/core is installed
    // because swc/core is a dependency of swc-loader
    return {
      loader: require.resolve('swc-loader'),
    };
  } catch (e) {
    throw new Error(
      '"swc-loader" not installed  in the workspace. Try `npm install --save-dev swc-loader` or `yarn add -D swc-loader`'
    );
  }
}

// TODO: change back to 2015 when https://github.com/swc-project/swc/issues/1108 is solved
// target: 'es2015'
const swcOptionsString = `{
  "jsc": {
    "target": "es2017",
    "parser": {
      "syntax": "typescript",
      "decorators": true,
      "dynamicImport": true
    },
    "transform": {
      "decoratorMetadata": true,
      "legacyDecorator": true
    },
    "keepClassNames": true,
    "externalHelpers": true,
    "loose": true
  },
  "module": {
    "type": "commonjs",
    "strict": true,
    "noInterop": true
  }
}`;

export function addSwcConfig(tree: Tree) {
  const isSwcConfigExist = tree.exists('.swcrc');
  if (isSwcConfigExist) return;

  tree.write('.swcrc', swcOptionsString);
}

export function addSwcDevDependencies(tree: Tree, isLib = false) {
  const devDeps = {
    '@swc/core': swcCoreVersion,
    '@swc/helpers': swcHelpersVersion,
  };

  if (isLib) {
    devDeps['@swc/cli'] = swcCliVersion;
  } else {
    devDeps['swc-loader'] = swcLoaderVersion;
  }

  return addDependenciesToPackageJson(tree, {}, devDeps);
}
