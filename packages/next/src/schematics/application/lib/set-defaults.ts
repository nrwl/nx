import { JsonObject } from '@angular-devkit/core';
import { noop, Rule } from '@angular-devkit/schematics';
import { updateWorkspace } from '@nrwl/workspace';
import { NormalizedSchema } from './normalize-options';

export function setDefaults(options: NormalizedSchema): Rule {
  return options.skipWorkspaceJson
    ? noop()
    : updateWorkspace((workspace) => {
        workspace.extensions.schematics = jsonIdentity(
          workspace.extensions.schematics || {}
        );
        workspace.extensions.schematics['@nrwl/next'] =
          workspace.extensions.schematics['@nrwl/next'] || {};
        const prev = jsonIdentity(
          workspace.extensions.schematics['@nrwl/next']
        );

        workspace.extensions.schematics = {
          ...workspace.extensions.schematics,
          '@nrwl/next': {
            ...prev,
            application: {
              style: options.style,
              linter: options.linter,
              ...jsonIdentity(prev.application),
            },
          },
        };
      });
}

function jsonIdentity(x: any): JsonObject {
  return x as JsonObject;
}
