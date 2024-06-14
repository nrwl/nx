import { joinPathFragments, offsetFromRoot } from '@nx/devkit';
import { RollupExecutorOptions } from '../../../executors/rollup/schema';

const executorPathFieldsToMigrate: Array<keyof RollupExecutorOptions> = [
  'tsConfig',
  'project',
  'main',
  'outputPath',
  'rollupConfig',
  'additionalEntryPoints',
];

export function normalizePathOptions(
  projectRoot: string,
  options: RollupExecutorOptions
): void {
  for (const [key, value] of Object.entries(options)) {
    if (
      !executorPathFieldsToMigrate.includes(key as keyof RollupExecutorOptions)
    )
      continue;

    if (Array.isArray(value)) {
      options[key] = value.map((v) =>
        normalizeValue(projectRoot, key as keyof RollupExecutorOptions, v)
      );
    } else {
      options[key] = normalizeValue(
        projectRoot,
        key as keyof RollupExecutorOptions,
        value
      );
    }
  }
}

function normalizeValue(
  projectRoot: string,
  key: keyof RollupExecutorOptions,
  value: string
): string {
  // Logic matches `@nx/rollup:rollup` in `normalizePluginPath` function.

  if (!value) return value;

  if (key === 'rollupConfig') {
    try {
      // If this can load as npm module, keep as is.
      require.resolve(value);
      return value;
    } catch {
      // Otherwise continue below convert to relative path from project.
    }
  }

  if (value.startsWith(`${projectRoot}/`)) {
    return value.replace(new RegExp(`^${projectRoot}/`), './');
  } else {
    return joinPathFragments(offsetFromRoot(projectRoot), value);
  }
}
