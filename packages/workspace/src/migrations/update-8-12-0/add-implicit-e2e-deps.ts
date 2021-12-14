import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

import { updateJsonInTree } from '../../utils/ast-utils';
import type { WorkspaceJsonConfiguration } from '@nrwl/devkit';
import { formatFiles } from '@nrwl/workspace/src/utils/rules/format-files';

const addE2eImplicitDependencies: Rule = (tree: Tree) =>
  updateJsonInTree<WorkspaceJsonConfiguration>(
    'workspace.json', // ngcli-adapter should handle conversion of workspace file names
    (json) => {
      Object.keys(json.projects).forEach((proj) => {
        const implicitE2eName = proj.replace(/-e2e$/, '');
        if (proj.endsWith('-e2e') && json.projects[implicitE2eName]) {
          json.projects[proj].implicitDependencies =
            json.projects[proj].implicitDependencies || [];
          if (
            !json.projects[proj].implicitDependencies.includes(implicitE2eName)
          ) {
            json.projects[proj].implicitDependencies.push(implicitE2eName);
          }
        }
      });
      return json;
    }
  );

function showInfo(host: Tree, context: SchematicContext) {
  context.logger.info(stripIndents`
    Nx no longer infers implicit dependencies between e2e projects and their source projects based on name.
    
    These dependencies have been added to nx.json.
  `);
}

export default function (): Rule {
  return chain([showInfo, addE2eImplicitDependencies, formatFiles()]);
}
