import {
  apply,
  filter,
  mergeWith,
  move,
  noop,
  Rule,
  template,
  url,
} from '@angular-devkit/schematics';
import { NormalizedSchema } from './normalize-options';
import {
  createAppJsx,
  createStyleRules,
} from './create-application-files.helpers';
import { names, offsetFromRoot } from '@nrwl/devkit';
import {
  toJS,
  updateTsConfigsToJs,
} from '@nrwl/workspace/src/utils/rules/to-js';

export function createApplicationFiles(options: NormalizedSchema): Rule {
  return mergeWith(
    apply(url(`./files`), [
      template({
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
      }),
      options.styledModule
        ? filter((file) => !file.endsWith(`.${options.style}`))
        : noop(),
      // Custom document is used for styled-components SSR in Next.js
      options.style === 'styled-components'
        ? noop()
        : filter((file) => file.indexOf('_document.tsx') === -1),
      options.unitTestRunner === 'none'
        ? filter((file) => file !== `/specs/index.spec.tsx`)
        : noop(),
      options.js ? filter((file) => file !== `/index.d.ts`) : noop(),
      options.js ? toJS() : noop(),
      move(options.appProjectRoot),
      options.js
        ? updateTsConfigsToJs({ projectRoot: options.appProjectRoot })
        : noop(),
    ])
  );
}
