import { logger } from '@nrwl/devkit';
import { workspaceRoot } from '@nrwl/devkit';
import { existsSync } from 'fs';
import { join, relative } from 'path';
import * as postcssImport from 'postcss-import';

export interface TailwindSetup {
  tailwindConfigPath: string;
  tailwindPackagePath: string;
}

export const tailwindDirectives = [
  '@tailwind',
  '@apply',
  '@layer',
  '@variants',
  '@responsive',
  '@screen',
];

export function getTailwindSetup(
  basePath: string,
  tailwindConfig?: string
): TailwindSetup | undefined {
  let tailwindConfigPath = tailwindConfig;

  if (!tailwindConfigPath) {
    tailwindConfigPath = getTailwindConfigPath(basePath, workspaceRoot);
  }

  // Only load Tailwind CSS plugin if configuration file was found.
  if (!tailwindConfigPath) {
    return undefined;
  }

  let tailwindPackagePath: string | undefined;
  try {
    tailwindPackagePath = require.resolve('tailwindcss');
  } catch {
    const relativeTailwindConfigPath = relative(
      workspaceRoot,
      tailwindConfigPath
    );
    logger.warn(
      `Tailwind CSS configuration file found (${relativeTailwindConfigPath})` +
        ` but the 'tailwindcss' package is not installed.` +
        ` To enable Tailwind CSS, please install the 'tailwindcss' package.`
    );

    return undefined;
  }

  if (!tailwindPackagePath) {
    return undefined;
  }

  return { tailwindConfigPath, tailwindPackagePath };
}

function getTailwindConfigPath(
  projectRoot: string,
  workspaceRoot: string
): string | undefined {
  // valid tailwind config files https://github.com/tailwindlabs/tailwindcss/blob/master/src/util/resolveConfigPath.js#L46
  const tailwindConfigFiles = ['tailwind.config.js', 'tailwind.config.cjs'];

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

export function getTailwindPostCssPlugins(
  { tailwindConfigPath, tailwindPackagePath }: TailwindSetup,
  includePaths?: string[],
  watch?: boolean
) {
  if (process.env['TAILWIND_MODE'] === undefined) {
    process.env['TAILWIND_MODE'] = watch ? 'watch' : 'build';
  }

  return [
    postcssImport({
      addModulesDirectories: includePaths ?? [],
      resolve: (url: string) => (url.startsWith('~') ? url.substring(1) : url),
    }),
    require(tailwindPackagePath)({ config: tailwindConfigPath }),
  ];
}
