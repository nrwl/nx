import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { type PluginSchemaWithExamples } from './plugin-schema-parser';
const EXAMPLE_SCHEMA_KEY = 'examplesFile';

/**
 * Get the example content from the provided schema
 * path is required to be able to correctly resolve the path to the docs file
 * @returns null for missing example file paths
 * @throws if the schema file is not found, or cannot parse as json
 */
export function getExampleForSchema(
  schemaPath: string,
  schema: PluginSchemaWithExamples
) {
  if (!existsSync(schemaPath)) {
    throw new Error(`Schema file ${schemaPath} does not exist`);
  }

  if (!schema[EXAMPLE_SCHEMA_KEY]) {
    return null;
  }
  const exampleFilePath = schema[EXAMPLE_SCHEMA_KEY];
  const schemaDirName = dirname(schemaPath);
  const docPath = resolvePath(schemaDirName, exampleFilePath);

  if (!existsSync(docPath)) {
    throw new Error(
      `Example file ${docPath} does not exist, listed in schema ${schemaPath}`
    );
  }

  const content = readFileSync(docPath, 'utf-8')?.trim();

  if (!content) {
    return null;
  }

  if (content.startsWith(`## Examples`)) {
    // TODO(caleb): remove this logic after we remove old nx-dev site which wanted to use `##` level headings
    // add extra `#` to make correct heading depth
    return `#${content}`;
  }

  return `### Examples\n\n${content}`;
}
