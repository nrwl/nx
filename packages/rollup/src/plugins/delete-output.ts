import type { Plugin } from 'rollup';
import { deleteOutputDir } from '../utils/fs';

export interface DeleteOutputOptions {
  dirs: string[];
}

export function deleteOutput(options: DeleteOutputOptions): Plugin {
  return {
    name: 'rollup-plugin-nx-delete-output',
    buildStart: () =>
      options.dirs.forEach((dir) => deleteOutputDir(process.cwd(), dir)),
  };
}
