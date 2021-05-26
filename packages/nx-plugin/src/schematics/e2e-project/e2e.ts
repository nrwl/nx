import { chain, Rule, Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@nrwl/workspace';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import { addFiles } from './lib/add-files';
import { addJest } from './lib/add-jest';
import { normalizeOptions } from './lib/normalize-options';
import { updateNxJson } from './lib/update-nx-json';
import { updateWorkspaceJson } from './lib/update-workspace-json';
import { validatePlugin } from './lib/validate-plugin';
import { Schema } from './schema';

export function e2eSchematic(options: Schema): Rule {
  return async (host: Tree) => {
    const workspace = await getWorkspace(host);
    validatePlugin(workspace, options.pluginName);
    const normalizedOptions = normalizeOptions(host, options);
    return chain([
      addFiles(normalizedOptions),
      updateNxJson(normalizedOptions),
      updateWorkspaceJson(normalizedOptions),
      addJest(normalizedOptions),
    ]);
  };
}

export default e2eSchematic;
export const e2eGenerator = wrapAngularDevkitSchematic(
  '@nrwl/nx-plugin',
  'e2e-project'
);
