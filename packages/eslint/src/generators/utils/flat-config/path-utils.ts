import { joinPathFragments } from '@nx/devkit';
import type { Linter } from 'eslint';

export function updateFiles(
  override: Linter.ConfigOverride<Linter.RulesRecord>
) {
  if (override.files) {
    override.files = Array.isArray(override.files)
      ? override.files
      : [override.files];
    override.files = override.files.map((file) => mapFilePath(file));
  }
  return override;
}

export function mapFilePath(filePath: string) {
  if (filePath.startsWith('!')) {
    const fileWithoutBang = filePath.slice(1);
    if (fileWithoutBang.startsWith('*.')) {
      return `!${joinPathFragments('**', fileWithoutBang)}`;
    }
    return filePath;
  }
  if (filePath.startsWith('*.')) {
    return joinPathFragments('**', filePath);
  }
  return filePath;
}
