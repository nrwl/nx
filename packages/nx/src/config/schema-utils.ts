import { existsSync } from 'fs';
import { extname, join } from 'path';
import { registerPluginTSTranspiler } from '../project-graph/plugins';

/**
 * This function is used to get the implementation factory of an executor or generator.
 * @param implementation path to the implementation
 * @param directory path to the directory
 * @returns a function that returns the implementation
 */
export function getImplementationFactory<T>(
  implementation: string,
  directory: string
): () => T {
  const [implementationModulePath, implementationExportName] =
    implementation.split('#');
  return () => {
    const modulePath = resolveImplementation(
      implementationModulePath,
      directory
    );
    if (extname(modulePath) === '.ts') {
      registerPluginTSTranspiler();
    }
    const module = require(modulePath);
    return implementationExportName
      ? module[implementationExportName]
      : module.default ?? module;
  };
}

/**
 * This function is used to resolve the implementation of an executor or generator.
 * @param implementationModulePath
 * @param directory
 * @returns path to the implementation
 */
export function resolveImplementation(
  implementationModulePath: string,
  directory: string
): string {
  const validImplementations = ['', '.js', '.ts'].map(
    (x) => implementationModulePath + x
  );

  for (const maybeImplementation of validImplementations) {
    const maybeImplementationPath = join(directory, maybeImplementation);
    if (existsSync(maybeImplementationPath)) {
      return maybeImplementationPath;
    }

    try {
      return require.resolve(maybeImplementation, {
        paths: [directory],
      });
    } catch {}
  }

  throw new Error(
    `Could not resolve "${implementationModulePath}" from "${directory}".`
  );
}

export function resolveSchema(schemaPath: string, directory: string): string {
  const maybeSchemaPath = join(directory, schemaPath);
  if (existsSync(maybeSchemaPath)) {
    return maybeSchemaPath;
  }

  return require.resolve(schemaPath, {
    paths: [directory],
  });
}
