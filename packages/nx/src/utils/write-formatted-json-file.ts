import { writeFileSync } from 'node:fs';
import { formatFileContents } from '../generators/internal-utils/format-changed-files';
import { serializeJson } from './json';
import type { JsonSerializeOptions } from './json';
import { writeJsonFile, type JsonWriteOptions } from './fileutils';
import { workspaceRoot } from './workspace-root';

/**
 * Writes a JSON file, formatting it with whichever formatter the workspace is
 * configured for, and falling back to standard JSON serialization when there
 * is none or it cannot format the file.
 */
export async function writeFormattedJsonFile<T extends object = object>(
  filePath: string,
  content: T,
  options?: JsonWriteOptions
): Promise<void> {
  const formattedContent = await formatFileContents(
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
