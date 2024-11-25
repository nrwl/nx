import { RspackExecutorSchema } from '../../../executors/rspack/schema';
import { toProjectRelativePath } from './utils';

const executorFieldsToNormalize: Array<keyof RspackExecutorSchema> = [
  'outputPath',
  'index',
  'main',
  'assets',
  'tsConfig',
  'styles',
  'additionalEntryPoints',
  'scripts',
  'fileReplacements',
  'postcssConfig',
  'stylePreprocessorOptions',
  'publicPath',
];

export function normalizePathOptions(
  projectRoot: string,
  options: Partial<RspackExecutorSchema>
) {
  for (const [key, value] of Object.entries(options)) {
    if (
      !executorFieldsToNormalize.includes(key as keyof RspackExecutorSchema)
    ) {
      continue;
    }
    options[key] = normalizePath(
      projectRoot,
      key as keyof RspackExecutorSchema,
      value
    );
  }
  return options;
}

function normalizePath<K extends keyof RspackExecutorSchema>(
  projectRoot: string,
  key: K,
  value: RspackExecutorSchema[K]
) {
  if (!value) return value;

  switch (key) {
    case 'assets':
      return value.map((asset) => {
        if (typeof asset === 'string') {
          return toProjectRelativePath(asset, projectRoot);
        }
        return {
          ...asset,
          input: toProjectRelativePath(asset.input, projectRoot),
          output: toProjectRelativePath(asset.output, projectRoot),
        };
      });

    case 'styles':
    case 'scripts':
      return value.map((item) => {
        if (typeof item === 'string') {
          return toProjectRelativePath(item, projectRoot);
        }
        return {
          ...item,
          input: toProjectRelativePath(item.input, projectRoot),
        };
      });

    case 'additionalEntryPoints':
      return value.map((entry) => {
        return {
          ...entry,
          entryPath: toProjectRelativePath(entry.entryPath, projectRoot),
        };
      });

    case 'fileReplacements':
      return value.map((replacement) => {
        return {
          replace: toProjectRelativePath(replacement.replace, projectRoot),
          with: toProjectRelativePath(replacement.with, projectRoot),
        };
      });

    default:
      return Array.isArray(value)
        ? value.map((item) => toProjectRelativePath(item, projectRoot))
        : toProjectRelativePath(value, projectRoot);
  }
}
