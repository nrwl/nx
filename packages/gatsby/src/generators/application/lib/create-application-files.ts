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

export function createApplicationFiles(host: Tree, options: NormalizedSchema) {
  const isPnpm = host.exists('pnpm-lock.yaml');
  const templateVariables = {
    ...options,
    isPnpm,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    tmpl: '',
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
