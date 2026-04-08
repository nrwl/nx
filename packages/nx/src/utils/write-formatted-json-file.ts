import { writeFileSync } from 'node:fs';
import { formatFilesWithPrettierIfAvailable } from '../generators/internal-utils/format-changed-files-with-prettier-if-available';
import { serializeJson } from './json';
import type { JsonSerializeOptions } from './json';
import { writeJsonFile, type JsonWriteOptions } from './fileutils';
import { workspaceRoot } from './workspace-root';

/**
 * Writes a JSON file, formatting with Prettier if available, otherwise
 * falling back to standard JSON serialization.
 */
export async function writeFormattedJsonFile<T extends object = object>(
  filePath: string,
  content: T,
  options?: JsonWriteOptions
): Promise<void> {
  const formattedContent = await formatFilesWithPrettierIfAvailable(
    [{ path: filePath, content: serializeJson(content) }],
    workspaceRoot,
    { silent: true }
  );

  if (formattedContent.has(filePath)) {
    writeFileSync(filePath, formattedContent.get(filePath)!, {
      encoding: 'utf-8',
    });
  } else {
    writeJsonFile(filePath, content, options);
  }
}
