import {
  formatFiles,
  joinPathFragments,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { componentGenerator } from '../component/component';
import { Schema } from './schema';

export async function pageGenerator(host: Tree, options: Schema) {
  const pageGenerator = await componentGenerator(host, {
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

  return runTasksInSerial(pageGenerator);
}

export function getDirectory(directory: string) {
  return directory?.length > 0
    ? directory.startsWith('pages/')
      ? directory
      : joinPathFragments(directory + '/pages')
    : 'pages';
}

export default pageGenerator;
