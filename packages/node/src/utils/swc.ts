import type { TypeScriptCompilationOptions } from '@nrwl/workspace/src/utilities/typescript';
import {
  getNormalizedTsConfig,
  normalizeOptions,
} from '@nrwl/workspace/src/utilities/typescript/compilation';
import { addDependenciesToPackageJson, logger, Tree } from '@nrwl/devkit';
import {
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

export function transformTypeScript(tscOptions: TypeScriptCompilationOptions): {
  success: boolean;
} {
  try {
    const { transformFileSync } = require('@swc/core');

    const normalizedTscOptions = normalizeOptions(tscOptions);
    const normalizedTsConfig = getNormalizedTsConfig(normalizedTscOptions);

    logger.info(
      `Compiling TypeScript files for project "${normalizedTscOptions.projectName}"...`
    );
    for (const fileName of normalizedTsConfig.fileNames) {
      transformFileSync(fileName);
    }
    logger.info(
      `Done compiling TypeScript files for project "${normalizedTscOptions.projectName}".`
    );
    return { success: true };
  } catch (e) {
    throw new Error(
      '"@swc/core" not installed  in the workspace. Try `npm install --save-dev @swc/core` or `yarn add -D @swc/core`'
    );
  }
}

export function addSwcConfig(tree: Tree) {
  const isSwcConfigExist = tree.exists('.swcrc');
  if (isSwcConfigExist) return;

  // TODO: change back to 2015 when https://github.com/swc-project/swc/issues/1108 is solved
  // target: 'es2015'
  tree.write(
    '.swcrc',
    `
{
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
}`
  );
}

export function addSwcDevDependencies(tree: Tree) {
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      '@swc/core': swcCoreVersion,
      '@swc/helpers': swcHelpersVersion,
      'swc-loader': swcLoaderVersion,
    }
  );
}
