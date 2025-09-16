import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { type PluginSchemaWithExamples } from './plugin-schema-parser';
const EXAMPLE_SCHEMA_KEY = 'examplesFile';

/**
 * Strip frontmatter from markdown content
 * Removes anything between the opening and closing --- delimiters
 */
function stripFrontmatter(content: string): string {
  const frontmatterPattern = /^---\s*\n[\s\S]*?\n---\s*\n/;
  return content.replace(frontmatterPattern, '').trim();
}

/**
 * Check if content contains any markdown headers
 */
function hasHeaders(content: string): boolean {
  const headerPattern = /^#{1,6}\s/m;
  return headerPattern.test(content);
}

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

  const rawContent = readFileSync(docPath, 'utf-8')?.trim();

  if (!rawContent) {
    return null;
  }

  // Strip frontmatter from the content
  const content = stripFrontmatter(rawContent);

  if (!content) {
    return null;
  }

  // If content already has headers, increase their level by 1 to nest under generator
  if (hasHeaders(content)) {
    return content.replace(/^(#{1,5})\s/gm, '#$1 ');
  }

  // Only add Examples header if there are no existing headers
  return `### Examples\n\n${content}`;
}
