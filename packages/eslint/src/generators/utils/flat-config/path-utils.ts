import { joinPathFragments } from '@nx/devkit';
import type { Linter } from 'eslint';

export function updateFiles(
  override: Linter.ConfigOverride<Linter.RulesRecord>,
  root: string
) {
  if (override.files) {
    override.files = Array.isArray(override.files)
      ? override.files
      : [override.files];
    override.files = override.files.map((file) => mapFilePath(file, root));
  }
  return override;
}

function mapFilePath(filePath: string, root: string) {
  if (filePath.startsWith('!')) {
    const fileWithoutBang = filePath.slice(1);
    if (fileWithoutBang.startsWith('*.')) {
      return `!${joinPathFragments(root, '**', fileWithoutBang)}`;
    } else {
      return `!${joinPathFragments(root, fileWithoutBang)}`;
    }
  }
  if (filePath.startsWith('*.')) {
    return joinPathFragments(root, '**', filePath);
  } else {
    return joinPathFragments(root, filePath);
  }
}
