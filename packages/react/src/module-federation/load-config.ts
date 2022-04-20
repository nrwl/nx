import { ExecutorContext } from '@nrwl/devkit';
import { join } from 'path';
import { ModuleFederationConfig } from './models';

export function loadModuleFederationConfigFromContext(
  context: ExecutorContext
): ModuleFederationConfig {
  const p = context.workspace.projects[context.projectName];
  const moduleFederationConfigPath = join(
    context.root,
    p.root,
    'module-federation.config.js'
  );

  try {
    return require(moduleFederationConfigPath) as ModuleFederationConfig;
  } catch {
    // TODO(jack): Add a link to guide
    throw new Error(
      `Could not load ${moduleFederationConfigPath}. Was this project generated with "@nrwl/react:host"?`
    );
  }
}
