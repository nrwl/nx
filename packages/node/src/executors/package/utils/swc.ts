import { logger } from '@nrwl/devkit';
import {
  emitTsProgram,
  getNormalizedTsConfig,
  normalizeOptions,
  TypeScriptCompilationOptions,
} from '@nrwl/workspace/src/utilities/typescript/compilation';
import { writeToFile } from '@nrwl/workspace/src/utils/fileutils';

export function transformTypeScript(tscOptions: TypeScriptCompilationOptions): {
  success: boolean;
} {
  try {
    const { transformFileSync } = require('@swc/core');

    const normalizedTscOptions = normalizeOptions(tscOptions);
    const normalizedTsConfig = getNormalizedTsConfig(normalizedTscOptions);
    const projectName = normalizedTscOptions.projectName;

    logger.info(`Generating d.ts files for project "${projectName}"...`);

    const results = emitTsProgram(
      {
        ...normalizedTsConfig.options,
        emitDeclarationOnly: true,
        declaration: true,
      },
      normalizedTsConfig.fileNames
    );

    if (results && !results.emitSkipped) {
      logger.info(`Done generating d.ts files for project "${projectName}".`);
    }

    logger.info(
      `Compiling TypeScript files for project "${projectName}" with swc...`
    );
    for (const fileName of normalizedTsConfig.fileNames) {
      const { code, map } = transformFileSync(fileName, { sourceMaps: true });
      moveToDist(
        code,
        map,
        fileName,
        projectName,
        normalizedTscOptions.outputPath
      );
    }
    logger.info(
      `Done compiling TypeScript files for project "${projectName}" with swc.`
    );
    return { success: true };
  } catch (e) {
    throw new Error(
      '"@swc/core" not installed  in the workspace. Try `npm install --save-dev @swc/core` or `yarn add -D @swc/core`'
    );
  }
}

function moveToDist(
  code: string,
  map: string,
  fileName: string,
  projectName: string,
  outputPath: string
): void {
  const sourceFileName = fileName.split(`/${projectName}/`).pop();

  const codeFileName = sourceFileName.replace('ts', 'js');
  writeToFile(`${outputPath}/${codeFileName}`, code);

  if (map) {
    const sourceMapFileName = sourceFileName.replace('ts', 'js.map');
    writeToFile(`${outputPath}/${sourceMapFileName}`, map);
  }
}
