import { formatFiles, joinPathFragments, Tree } from '@nx/devkit';
import { componentGenerator } from '../component/component';
import { Schema } from './schema';

export async function pageGenerator(host: Tree, options: Schema) {
  await componentGenerator(host, {
    ...options,
    directory: getDirectory(options.directory),
    skipTests: true,
    flat: true,
    pascalCaseFiles: false, // it's good to keep route names lowercase
    pascalCaseDirectory: false,
    skipFormat: true,
  });

  if (!options.skipFormat) {
    await formatFiles(host);
  }
}

export function getDirectory(directory: string) {
  return directory?.length > 0
    ? directory.startsWith('pages/')
      ? directory
      : joinPathFragments('pages', directory)
    : 'pages';
}

export default pageGenerator;
