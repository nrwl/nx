import { join } from 'path';
import { NormalizedSchema } from './normalize-options';
import {
  createAppJsx,
  createStyleRules,
} from './create-application-files.helpers';
import { generateFiles, names, offsetFromRoot, toJS, Tree } from '@nrwl/devkit';

export function createApplicationFiles(host: Tree, options: NormalizedSchema) {
  const templateVariables = {
    ...names(options.name),
    ...options,
    tmpl: '',
    offsetFromRoot: offsetFromRoot(options.appProjectRoot),
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
    join(__dirname, '../files'),
    options.appProjectRoot,
    templateVariables
  );

  if (options.unitTestRunner === 'none') {
    host.delete(`${options.appProjectRoot}/specs/${options.fileName}.spec.tsx`);
  }

  // SWC will be disabled if custom babelrc is provided.
  // Check for `!== false` because `create-nx-workspace` is not passing default values.
  if (options.swc !== false) {
    host.delete(`${options.appProjectRoot}/.babelrc`);
  }

  if (options.styledModule) {
    host.delete(
      `${options.appProjectRoot}/pages/${options.fileName}.module.${options.style}`
    );
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
