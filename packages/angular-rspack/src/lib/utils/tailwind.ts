import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const tailwindConfigFiles: string[] = [
  'tailwind.config.js',
  'tailwind.config.cjs',
  'tailwind.config.mjs',
  'tailwind.config.ts',
];

export async function findTailwindConfigurationFile(
  workspaceRoot: string,
  projectRoot: string
): Promise<string | undefined> {
  try {
    const dirEntries = [projectRoot, workspaceRoot].map((root) =>
      readdir(root, { withFileTypes: false }).then((entries) => ({
        root,
        files: new Set(entries),
      }))
    );

    // A configuration file can exist in the project or workspace root
    for (const { root, files } of await Promise.all(dirEntries)) {
      for (const potentialConfig of tailwindConfigFiles) {
        if (files.has(potentialConfig)) {
          return join(root, potentialConfig);
        }
      }
    }
  } catch {
    // ignore
  }

  return undefined;
}
