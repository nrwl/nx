import * as path from 'path';
import type { RspackPluginInstance } from '@rspack/core';

import { getOutputHashFormat } from './hash-format';
import { ScriptsRspackPlugin } from './plugins/scripts-rspack-plugin';
import { normalizeExtraEntryPoints } from './normalize-entry';

export function instantiateScriptPlugins(options: any): RspackPluginInstance[] {
  // process global scripts
  const globalScriptsByBundleName = normalizeExtraEntryPoints(
    options.scripts || [],
    'scripts'
  ).reduce(
    (
      prev: { inject: boolean; bundleName: string; paths: string[] }[],
      curr
    ) => {
      const bundleName = curr.bundleName;
      const resolvedPath = path.resolve(options.root, curr.input);
      const existingEntry = prev.find((el) => el.bundleName === bundleName);
      if (existingEntry) {
        existingEntry.paths.push(resolvedPath);
      } else {
        prev.push({
          inject: curr.inject,
          bundleName,
          paths: [resolvedPath],
        });
      }

      return prev;
    },
    []
  );

  const hashFormat = getOutputHashFormat(options.outputHashing as string);
  const plugins = [];
  // Add a new asset for each entry.
  globalScriptsByBundleName.forEach((script) => {
    const hash = script.inject ? hashFormat.script : '';
    const bundleName = script.bundleName;

    plugins.push(
      new ScriptsRspackPlugin({
        name: bundleName,
        sourceMap: !!options.sourceMap,
        filename: `${path.basename(bundleName)}${hash}.js`,
        scripts: script.paths,
        basePath: options.sourceRoot,
      })
    );
  });

  return plugins;
}
