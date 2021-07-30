import { libraryGenerator as reactLibraryGenerator } from '@nrwl/react';
import {
  convertNxGenerator,
  getWorkspaceLayout,
  joinPathFragments,
  names,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { Schema } from './schema';

export async function libraryGenerator(host: Tree, options: Schema) {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;

  const { libsDir } = getWorkspaceLayout(host);
  const projectRoot = joinPathFragments(`${libsDir}/${projectDirectory}`);

  const task = await reactLibraryGenerator(host, options);

  updateJson(host, joinPathFragments(projectRoot, '.babelrc'), (json) => {
    if (options.style === '@emotion/styled') {
      json.presets = [
        'next/babel',
        {
          'preset-react': {
            importSource: '@emotion/react',
          },
        },
      ];
    } else {
      json.presets = ['next/babel'];
    }
    return json;
  });

  return task;
}

export default libraryGenerator;
export const librarySchematic = convertNxGenerator(libraryGenerator);
