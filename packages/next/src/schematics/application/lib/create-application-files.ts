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
import { names, offsetFromRoot } from '@nrwl/workspace';
import { NormalizedSchema } from './normalize-options';
import {
  createAppJsx,
  createStyleRules,
} from './create-application-files.helpers';

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
      move(options.appProjectRoot),
    ])
  );
}
