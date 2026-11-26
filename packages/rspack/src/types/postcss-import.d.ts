declare module 'postcss-import' {
  import type { PluginCreator } from 'postcss';

  const postcssImport: PluginCreator<{
    addModulesDirectories?: string[];
    resolve?: (id: string, basedir: string) => string | string[];
  }>;

  export = postcssImport;
}
