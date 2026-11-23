import { WebpackExecutorOptions } from '../../../executors/webpack/schema';
import { toProjectRelativePath } from './utils';

const executorFieldsToNormalize: Array<keyof WebpackExecutorOptions> = [
  'outputPath',
  'index',
  'main',
  'assets',
  'tsConfig',
  'styles',
  'babelConfig',
  'additionalEntryPoints',
  'scripts',
  'fileReplacements',
  'postcssConfig',
  'stylePreprocessorOptions',
  'publicPath',
];

type ArrayItem<K extends keyof WebpackExecutorOptions> =
  NonNullable<WebpackExecutorOptions[K]> extends Array<infer T> ? T : never;

export function normalizePathOptions(
  projectRoot: string,
  options: Partial<WebpackExecutorOptions>
) {
  for (const [key, value] of Object.entries(options)) {
    if (
      !executorFieldsToNormalize.includes(key as keyof WebpackExecutorOptions)
    ) {
      continue;
    }
    Object.assign(options, {
      [key]: normalizePath(
        projectRoot,
        key as keyof WebpackExecutorOptions,
        value
      ),
    });
  }
  return options;
}

function normalizePath<K extends keyof WebpackExecutorOptions>(
  projectRoot: string,
  key: K,
  value: WebpackExecutorOptions[K]
) {
  if (!value) return value;

  switch (key) {
    case 'assets':
      return value.map((asset: ArrayItem<'assets'>) => {
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
      return value.map((item: ArrayItem<'styles' | 'scripts'>) => {
        if (typeof item === 'string') {
          return toProjectRelativePath(item, projectRoot);
        }
        return {
          ...item,
          input: toProjectRelativePath(item.input, projectRoot),
        };
      });

    case 'additionalEntryPoints':
      return value.map((entry: ArrayItem<'additionalEntryPoints'>) => {
        return {
          ...entry,
          entryPath: toProjectRelativePath(entry.entryPath, projectRoot),
        };
      });

    case 'fileReplacements':
      return value.map((replacement: ArrayItem<'fileReplacements'>) => {
        return {
          replace: toProjectRelativePath(replacement.replace, projectRoot),
          with: toProjectRelativePath(replacement.with, projectRoot),
        };
      });

    default:
      return Array.isArray(value)
        ? value.map((item: string) => toProjectRelativePath(item, projectRoot))
        : toProjectRelativePath(value, projectRoot);
  }
}
