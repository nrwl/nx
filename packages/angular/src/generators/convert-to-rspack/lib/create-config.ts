import { joinPathFragments, type Tree } from '@nx/devkit';

export interface CreateConfigOptions {
  root: string;
  index: string;
  browser: string;
  server?: string;
  ssrEntry?: string;
  polyfills: string[];
  tsconfigPath: string;
  assets: string[];
  styles: string[];
  scripts: string[];
  jit?: boolean;
  inlineStylesExtension?: string;
  fileReplacements?: string[];
  stylePreprocessorOptions?: Record<string, unknown>;
}

export function createConfig(
  tree: Tree,
  opts: Partial<CreateConfigOptions>,
  existingWebpackConfigPath?: string,
  isExistingWebpackConfigFunction?: boolean
) {
  const configContents = `import { resolve } from 'path';
  import { createConfig }from '@ng-rspack/build';
  ${
    existingWebpackConfigPath
      ? `import baseWebpackConfig from '${existingWebpackConfigPath}';
      ${
        isExistingWebpackConfigFunction
          ? ''
          : `import webpackMerge from 'webpack-merge';`
      }`
      : ''
  }
  
  ${
    existingWebpackConfigPath ? 'const baseConfig = ' : 'export default '
  }createConfig({
    root: __dirname,
    index: '${normalizeFromProjectRoot(opts.index, opts.root)}',
    browser: '${normalizeFromProjectRoot(opts.browser, opts.root)}',
    ${
      opts.server
        ? `server: '${normalizeFromProjectRoot(opts.server, opts.root)}',`
        : ''
    }
    ${
      opts.ssrEntry
        ? `ssrEntry: '${normalizeFromProjectRoot(opts.ssrEntry, opts.root)}',`
        : ''
    }
    tsconfigPath: resolve(__dirname, '${normalizeFromProjectRoot(
      opts.tsconfigPath,
      opts.root
    )}'),
    polyfills: ${JSON.stringify(opts.polyfills)},
    assets: ${JSON.stringify(
      opts.assets.map((a) => normalizeFromProjectRoot(a, opts.root))
    )},
    styles: ${JSON.stringify(
      opts.styles.map((s) => normalizeFromProjectRoot(s, opts.root))
    )},
    scripts: ${JSON.stringify(
      opts.scripts.map((s) => normalizeFromProjectRoot(s, opts.root))
    )},
    jit: ${opts.jit},
    ${
      opts.inlineStylesExtension
        ? `inlineStylesExtension: '${opts.inlineStylesExtension}'`
        : ''
    },
    fileReplacements: ${JSON.stringify(opts.fileReplacements ?? [])},${
    opts.stylePreprocessorOptions !== undefined
      ? `
    stylePreprocessorOptions: ${JSON.stringify(opts.stylePreprocessorOptions)},`
      : ''
  }
    hasServer: ${opts.server || opts.ssrEntry ? true : false},
    skipTypeChecking: false,
  });
  ${
    existingWebpackConfigPath
      ? `
    export default ${
      isExistingWebpackConfigFunction
        ? `async function (env, argv) { 
        const oldConfig = await baseWebpackConfig;
        const browserConfig = baseConfig[0];
        return oldConfig(browserConfig);
      }`
        : 'webpackMerge(baseConfig[0], baseWebpackConfig)'
    }
  `
      : ''
  }
  `;
  tree.write(joinPathFragments(opts.root, 'rspack.config.ts'), configContents);
}

function normalizeFromProjectRoot(path: string, projectRoot: string) {
  if (projectRoot === '.') {
    if (!path.startsWith('./')) {
      return `./${path}`;
    } else {
      return path;
    }
  } else if (path.startsWith(projectRoot)) {
    return path.replace(projectRoot, '.');
  } else if (!path.startsWith('./')) {
    return `./${path}`;
  }
  return path;
}
