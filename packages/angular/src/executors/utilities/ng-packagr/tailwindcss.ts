import { existsSync } from 'fs';
import { join } from 'path';

export function getTailwindConfigPath(
  projectRoot: string,
  workspaceRoot: string
): string | undefined {
  // valid tailwind config files https://github.com/tailwindlabs/tailwindcss/blob/master/src/util/resolveConfigPath.js#L4
  const tailwindConfigFiles = [
    'tailwind.config.js',
    'tailwind.config.cjs',
    'tailwind.config.mjs',
    'tailwind.config.ts',
  ];

  for (const basePath of [projectRoot, workspaceRoot]) {
    for (const configFile of tailwindConfigFiles) {
      const fullPath = join(basePath, configFile);
      if (existsSync(fullPath)) {
        return fullPath;
      }
    }
  }

  return undefined;
}
