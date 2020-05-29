import { noop, Rule } from '@angular-devkit/schematics';
import { updateWorkspace } from '@nrwl/workspace';
import { NormalizedSchema } from '../schema';
import { JsonObject } from '@angular-devkit/core';

export function setDefaults(options: NormalizedSchema): Rule {
  return options.skipWorkspaceJson
    ? noop()
    : updateWorkspace((workspace) => {
        workspace.extensions.schematics = jsonIdentity(
          workspace.extensions.schematics || {}
        );
        workspace.extensions.schematics['@nrwl/react'] =
          workspace.extensions.schematics['@nrwl/react'] || {};
        const prev = jsonIdentity(
          workspace.extensions.schematics['@nrwl/react']
        );

        workspace.extensions.schematics = {
          ...workspace.extensions.schematics,
          '@nrwl/react': {
            ...prev,
            application: {
              style: options.style,
              linter: options.linter,
              ...jsonIdentity(prev.application),
            },
            component: {
              style: options.style,
              ...jsonIdentity(prev.component),
            },
            library: {
              style: options.style,
              linter: options.linter,
              ...jsonIdentity(prev.library),
            },
          },
        };
      });
}

function jsonIdentity(x: any): JsonObject {
  return x as JsonObject;
}
