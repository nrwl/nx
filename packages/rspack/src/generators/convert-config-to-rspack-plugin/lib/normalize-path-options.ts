import { RspackExecutorSchema } from '../../../executors/rspack/schema';
import { toProjectRelativePath } from './utils';

const stringFieldsToNormalize = [
  'outputPath',
  'index',
  'main',
  'tsConfig',
  'postcssConfig',
  'publicPath',
] as const;

export function normalizePathOptions(
  projectRoot: string,
  options: Partial<RspackExecutorSchema>
) {
  const toRelative = (path: string) => toProjectRelativePath(path, projectRoot);

  for (const key of stringFieldsToNormalize) {
    const value = options[key];
    if (value) {
      options[key] = toRelative(value);
    }
  }

  if (options.assets) {
    options.assets = options.assets.map((asset) => {
      if (typeof asset === 'string') {
        return toRelative(asset);
      }
      return {
        ...asset,
        input: toRelative(asset.input),
        output: toRelative(asset.output),
      };
    });
  }

  if (options.styles) {
    options.styles = options.styles.map((item) =>
      typeof item === 'string'
        ? toRelative(item)
        : { ...item, input: toRelative(item.input) }
    );
  }

  if (options.scripts) {
    options.scripts = options.scripts.map((item) =>
      typeof item === 'string'
        ? toRelative(item)
        : { ...item, input: toRelative(item.input) }
    );
  }

  if (options.additionalEntryPoints) {
    options.additionalEntryPoints = options.additionalEntryPoints.map(
      (entry) => ({ ...entry, entryPath: toRelative(entry.entryPath) })
    );
  }

  if (options.fileReplacements) {
    options.fileReplacements = options.fileReplacements.map((replacement) => ({
      replace: toRelative(replacement.replace),
      with: toRelative(replacement.with),
    }));
  }

  return options;
}
