import { Tree } from '@nrwl/tao/src/shared/tree';
import { visitNotIgnoredFiles } from '../generators/visit-not-ignored-files';

export function moveFilesToNewDirectory(
  host: Tree,
  oldDir: string,
  newDir: string
): void {
  visitNotIgnoredFiles(host, oldDir, (file) => {
    try {
      host.rename(file, file.replace(oldDir, newDir));
    } catch (e) {
      if (!host.exists(oldDir)) {
        console.warn(`Path ${oldDir} does not exist`);
      } else if (!host.exists(newDir)) {
        console.warn(`Path ${newDir} does not exist`);
      }
    }
  });
}
