import { workspaceRoot } from '@nx/devkit';
import { mergeConfig } from 'metro-config';
import type { MetroConfig } from 'metro-config';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'path';

import { getResolveRequest } from './metro-resolver';

interface WithNxOptions {
  /**
   * Change this to true to see debugging info.
   */
  debug?: boolean;
  /**
   * A list of additional file extensions to resolve
   * All the file extensions used for imports other than 'ts', 'tsx', 'js', 'jsx', 'json'
   */
  extensions?: string[];
  /**
   * A list of additional folders to watch for changes
   * By default, it watches all the folders in the workspace root except 'dist' and 'e2e'
   */
  watchFolders?: string[];
  /*
   * A list of exports field condition names in node_modules libraries' package.json
   * If a library has a package.json with an exports field, but it can't be resolved with the default conditions, you can add the name of the condition to this list.
   */
  exportsConditionNames?: string[];
  /**
   * A list of main fields in package.json files to use for resolution
   * If a library has a package.json with a main field that can't be resolved with the default conditions, you can add the name of the field to this list.
   */
  mainFields?: string[];
}

export async function withNxMetro(
  userConfig: MetroConfig,
  opts: WithNxOptions = {}
) {
  const extensions = ['', 'ts', 'tsx', 'js', 'jsx', 'json'];
  if (opts.debug) process.env.NX_REACT_NATIVE_DEBUG = 'true';
  if (opts.extensions) extensions.push(...opts.extensions);

  let watchFolders = readdirSync(workspaceRoot)
    .filter(
      (fileName) =>
        !['dist', 'e2e'].includes(fileName) && !fileName.startsWith('.')
    )
    .map((fileName) => join(workspaceRoot, fileName))
    .filter((filePath) => statSync(filePath).isDirectory());

  if (opts.watchFolders?.length) {
    watchFolders = watchFolders.concat(opts.watchFolders);
  }

  watchFolders = [...new Set(watchFolders)].filter((folder) =>
    existsSync(folder)
  );

  const nxConfig: MetroConfig = {
    resolver: {
      resolveRequest: getResolveRequest(
        extensions,
        opts.exportsConditionNames,
        opts.mainFields
      ),
      nodeModulesPaths: [join(workspaceRoot, 'node_modules')],
    },
    watchFolders,
  };

  return mergeConfig(userConfig, nxConfig);
}
