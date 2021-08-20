import { logger } from '@nrwl/devkit';
import {
  getNormalizedTsConfig,
  normalizeOptions,
  TypeScriptCompilationOptions,
} from '@nrwl/workspace/src/utilities/typescript/compilation';

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
