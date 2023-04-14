import {
  convertNxGenerator,
  formatFiles,
  GeneratorCallback,
  joinPathFragments,
  runTasksInSerial,
  Tree,
  updateJson,
} from '@nrwl/devkit';
import { libraryGenerator as reactLibraryGenerator } from '@nrwl/react/src/generators/library/library';
import { addTsConfigPath } from '@nrwl/js';

import { nextInitGenerator } from '../init/init';
import { Schema } from './schema';
import { normalizeOptions } from './lib/normalize-options';

export async function libraryGenerator(host: Tree, rawOptions: Schema) {
  const options = normalizeOptions(host, rawOptions);
  const tasks: GeneratorCallback[] = [];
  const initTask = await nextInitGenerator(host, {
    ...options,
    skipFormat: true,
  });
  tasks.push(initTask);

  const libTask = await reactLibraryGenerator(host, {
    ...options,
    compiler: 'swc',
    skipFormat: true,
  });
  tasks.push(libTask);

  const indexPath = joinPathFragments(
    options.projectRoot,
    'src',
    `index.${options.js ? 'js' : 'ts'}`
  );
  const indexContent = host.read(indexPath, 'utf-8');
  host.write(
    indexPath,
    `// Use this file to export React client components (e.g. those with 'use client' directive) or other non-server utilities\n${indexContent}`
  );
  // Additional entry for Next.js libraries so React Server Components are exported from a separate entry point.
  // This is needed because RSC exported from `src/index.ts` will mark the entire file as server-only and throw an error when used from a client component.
  // See: https://github.com/nrwl/nx/issues/15830
  const serverEntryPath = joinPathFragments(
    options.projectRoot,
    './src',
    'server.' + (options.js ? 'js' : 'ts')
  );
  host.write(
    joinPathFragments(
      options.projectRoot,
      'src',
      `server.${options.js ? 'js' : 'ts'}`
    ),
    `// Use this file to export React server components\n`
  );
  addTsConfigPath(host, `${options.importPath}/server`, [serverEntryPath]);

  updateJson(
    host,
    joinPathFragments(options.projectRoot, '.babelrc'),
    (json) => {
      if (options.style === '@emotion/styled') {
        json.presets = [
          [
            '@nrwl/next/babel',
            {
              'preset-react': {
                runtime: 'automatic',
                importSource: '@emotion/react',
              },
            },
          ],
        ];
      } else if (options.style === 'styled-jsx') {
        // next.js doesn't require the `styled-jsx/babel' plugin as it is already
        // built-into the `next/babel` preset
        json.presets = ['@nrwl/next/babel'];
        json.plugins = (json.plugins || []).filter(
          (x) => x !== 'styled-jsx/babel'
        );
      } else {
        json.presets = ['@nrwl/next/babel'];
      }
      return json;
    }
  );

  updateJson(
    host,
    joinPathFragments(options.projectRoot, 'tsconfig.json'),
    (json) => {
      if (options.style === '@emotion/styled') {
        json.compilerOptions.jsxImportSource = '@emotion/react';
      }
      return json;
    }
  );

  updateJson(
    host,
    joinPathFragments(options.projectRoot, 'tsconfig.lib.json'),
    (json) => {
      if (!json.files) {
        json.files = [];
      }
      json.files = json.files.map((path: string) => {
        if (path.endsWith('react/typings/image.d.ts')) {
          return path.replace(
            '@nrwl/react/typings/image.d.ts',
            '@nrwl/next/typings/image.d.ts'
          );
        }
        return path;
      });
      return json;
    }
  );

  if (!options.skipFormat) {
    await formatFiles(host);
  }

  return runTasksInSerial(...tasks);
}

export default libraryGenerator;
export const librarySchematic = convertNxGenerator(libraryGenerator);
