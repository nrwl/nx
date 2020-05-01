import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import { formatFiles, readWorkspace, updateJsonInTree } from '@nrwl/workspace';

function updateLintConfigurations(host: Tree, context: SchematicContext) {
  const workspaceJson = readWorkspace(host);
  Object.values(workspaceJson.projects).forEach((config: any) => {
    if (!config.architect || !config.architect.lint) return;
    if (config.architect.lint.builder === '@nrwl/linter:lint') {
      updateJson(
        (json) => {
          // Prefix it so that previously ignored files will override the whitelist.
          json.ignorePatterns = ['!**/*', ...(json.ignorePatterns || [])];
          return json;
        },
        config.architect.lint.options.config,
        host,
        context
      );
    }
    if (
      config.architect.lint.builder === '@angular-devkit/build-angular:tslint'
    ) {
      updateJson(
        (json) => {
          json.linterOptions = {
            ...json.linterOptions,
            // Prefix it so that previously ignored files will override the whitelist.
            exclude: [
              '!**/*',
              ...((json.linterOptions && json.linterOptions.exclude) || []),
            ],
          };
          return json;
        },
        `${config.root}/tslint.json`,
        host,
        context
      );
    }
  });
}

function updateJson(visitor, path, host, context) {
  try {
    if (host.exists(path)) {
      // In case tslint.json does not exist we don't want to create it.
      updateJsonInTree(path, visitor)(host, context);
    }
  } catch {
    context.logger.warn(`Could not update ${path}`);
  }
}

export default function () {
  return chain([updateLintConfigurations, formatFiles()]);
}
