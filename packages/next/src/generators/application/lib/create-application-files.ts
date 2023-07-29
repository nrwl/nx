import { join } from 'path';
import {
  generateFiles,
  joinPathFragments,
  names,
  offsetFromRoot as _offsetFromRoot,
  readJson,
  toJS,
  Tree,
  updateJson,
} from '@nx/devkit';
import { getRelativePathToRootTsConfig } from '@nx/js';

import { NormalizedSchema } from './normalize-options';
import {
  createAppJsx,
  createStyleRules,
} from './create-application-files.helpers';

export function createApplicationFiles(host: Tree, options: NormalizedSchema) {
  const offsetFromRoot = _offsetFromRoot(options.appProjectRoot);
  const layoutTypeSrcPath = joinPathFragments(
    offsetFromRoot,
    options.appProjectRoot,
    '.next/types/**/*.ts'
  );
  const layoutTypeDistPath = joinPathFragments(
    offsetFromRoot,
    options.outputPath,
    '.next/types/**/*.ts'
  );
  const templateVariables = {
    ...names(options.name),
    ...options,
    dot: '.',
    tmpl: '',
    offsetFromRoot,
    layoutTypeSrcPath,
    layoutTypeDistPath,
    rootTsConfigPath: getRelativePathToRootTsConfig(
      host,
      options.appProjectRoot
    ),
    appContent: createAppJsx(options.name),
    styleContent: createStyleRules(),
    pageStyleContent: `.page {}`,

    stylesExt:
      options.style === 'less' || options.style === 'styl'
        ? options.style
        : 'css',
  };

  generateFiles(
    host,
    join(__dirname, '../files/common'),
    options.appProjectRoot,
    templateVariables
  );

  if (options.appDir) {
    generateFiles(
      host,
      join(__dirname, '../files/app'),
      join(options.appProjectRoot, 'app'),
      templateVariables
    );

    // RSC is not possible to unit test without extra helpers for data fetching. Leaving it to the user to figure out.
    host.delete(
      joinPathFragments(
        options.appProjectRoot,
        'specs',
        `index.spec.${options.js ? 'jsx' : 'tsx'}`
      )
    );

    if (options.style === 'styled-components') {
      generateFiles(
        host,
        join(__dirname, '../files/app-styled-components'),
        join(options.appProjectRoot, 'app'),
        templateVariables
      );
    } else if (options.style === 'styled-jsx') {
      generateFiles(
        host,
        join(__dirname, '../files/app-styled-jsx'),
        join(options.appProjectRoot, 'app'),
        templateVariables
      );
    } else {
      generateFiles(
        host,
        join(__dirname, '../files/app-default-layout'),
        join(options.appProjectRoot, 'app'),
        templateVariables
      );
    }
  } else {
    generateFiles(
      host,
      join(__dirname, '../files/pages'),
      join(options.appProjectRoot, 'pages'),
      templateVariables
    );
  }

  if (options.rootProject) {
    updateJson(host, 'tsconfig.base.json', (json) => {
      const appJSON = readJson(host, 'tsconfig.json');

      let { extends: _, ...updatedJson } = json;

      // Don't generate the `paths` object or else workspace libs will not work later.
      // It'll be generated as needed when a lib is first added.
      delete json.compilerOptions.paths;

      updatedJson = {
        ...updateJson,
        compilerOptions: {
          ...updatedJson.compilerOptions,
          ...appJSON.compilerOptions,
        },
        include: [
          ...new Set([
            ...(updatedJson.include || []),
            ...(appJSON.include || []),
          ]),
        ],
        exclude: [
          ...new Set([
            ...(updatedJson.exclude || []),
            ...(appJSON.exclude || []),
            '**e2e/**/*',
            `dist/${options.name}/**/*`,
          ]),
        ],
      };
      return updatedJson;
    });
    host.delete('tsconfig.json');
    host.rename('tsconfig.base.json', 'tsconfig.json');
  }

  if (options.unitTestRunner === 'none') {
    host.delete(`${options.appProjectRoot}/specs/${options.fileName}.spec.tsx`);
  }

  // SWC will be disabled if custom babelrc is provided.
  // Check for `!== false` because `create-nx-workspace` is not passing default values.
  if (options.swc !== false) {
    host.delete(`${options.appProjectRoot}/.babelrc`);
  }

  if (options.styledModule) {
    if (options.appDir) {
      host.delete(`${options.appProjectRoot}/app/page.module.${options.style}`);
    } else {
      host.delete(
        `${options.appProjectRoot}/pages/${options.fileName}.module.${options.style}`
      );
    }
  }

  if (options.style !== 'styled-components') {
    host.delete(`${options.appProjectRoot}/pages/_document.tsx`);
  }

  if (options.js) {
    host.delete(`${options.appProjectRoot}/index.d.ts`);
    toJS(host);
    host.delete(`${options.appProjectRoot}/next-env.d.js`);
  }
}
