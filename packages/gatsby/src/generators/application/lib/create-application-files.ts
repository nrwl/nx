import { join } from 'path';
import { NormalizedSchema } from './normalize-options';
import {
  generateFiles,
  names,
  offsetFromRoot,
  toJS,
  Tree,
  updateTsConfigsToJs,
} from '@nrwl/devkit';
import {
  createAppJsx,
  createPageStyleContent,
  createPageWrapperStyle,
} from './create-application-files.helpers';

export function createApplicationFiles(host: Tree, options: NormalizedSchema) {
  const isPnpm = host.exists('pnpm-lock.yaml');
  const templateVariables = {
    ...options,
    isPnpm,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    tmpl: '',
    appContent: createAppJsx(options.name),
    pageWrapperStyle: createPageWrapperStyle(),
    pageStyleContent: createPageStyleContent(),
  };

  generateFiles(
    host,
    join(__dirname, '../files'),
    options.projectRoot,
    templateVariables
  );

  if (options.styledModule) {
    host.delete(
      `${options.projectRoot}/src/pages/index.module.${options.style}`
    );
  }
  if (options.js) {
    toJS(host);
    updateTsConfigsToJs(host, { projectRoot: options.projectRoot });
  }
}
