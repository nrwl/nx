import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { join, normalize } from '@angular-devkit/core';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';

import { updateJsonInTree } from '../../utils/ast-utils';
import { getWorkspace } from '../../utils/workspace';
import { formatFiles } from '@nrwl/workspace';

async function fixTslints(host: Tree) {
  const workspace = await getWorkspace(host);
  const rules: Rule[] = [];
  workspace.projects.forEach((proj) => {
    const tslintPath = join(normalize(proj.root), 'tslint.json');
    if (host.exists(tslintPath)) {
      rules.push(
        updateJsonInTree(tslintPath, (json, context) => {
          if (Array.isArray(json.rules)) {
            if (json.rules.length === 0) {
              json.rules = {};
            } else {
              context.logger.warn(
                `"rules" in "${tslintPath}" is an array but should be an object.`
              );
            }
          }
          return json;
        })
      );
    }
  });

  rules.push(formatFiles());

  return chain(rules);
}

function showInfo(host: Tree, context: SchematicContext) {
  context.logger.info(stripIndents`
    Nx generated invalid tslint configurations in a prior version.
    
    These invalid configurations will be fixed.
  `);
}

export default function (): Rule {
  return chain([showInfo, fixTslints]);
}
