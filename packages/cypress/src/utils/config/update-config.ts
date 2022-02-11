import {
  createPrinter,
  createSourceFile,
  ScriptTarget,
  transform,
} from 'typescript';
import {
  CypressConfigWithoutDevServer,
  mergeCypressConfigs,
} from './transformers';

// TODO(caleb): handle devserver in config
export function addOrUpdateConfigProperties(
  configContent: string,
  config: CypressConfigWithoutDevServer,
  overwrite: boolean = false
) {
  const sourceFile = createSourceFile(
    'cypress.config.ts',
    configContent,
    ScriptTarget.Latest,
    true
  );

  const transformedResult = transform(sourceFile, [
    mergeCypressConfigs(config, overwrite),
  ]);

  return createPrinter().printFile(transformedResult.transformed[0]);
}

export function removeConfigProperties() {}

export function addConfigImport() {}

export function removeConfigImport() {}
