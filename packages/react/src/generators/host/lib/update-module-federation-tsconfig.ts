import { joinPathFragments, type Tree, updateJson } from '@nx/devkit';
import { NormalizedSchema } from '../schema';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';

export function updateModuleFederationTsconfig(
  host: Tree,
  options: NormalizedSchema
) {
  const tsconfigPath = joinPathFragments(
    options.appProjectRoot,
    'tsconfig.json'
  );
  const tsconfigRuntimePath = joinPathFragments(
    options.appProjectRoot,
    'tsconfig.app.json'
  );
  if (!host.exists(tsconfigPath) || !host.exists(tsconfigRuntimePath)) return;

  // Not setting `baseUrl` does not work with MF.
  if (isUsingTsSolutionSetup(host)) {
    updateJson(host, 'tsconfig.base.json', (json) => {
      json.compilerOptions.baseUrl = '.';
      return json;
    });

    // Update references to match what `nx sync` does.
    if (options.remotes?.length) {
      updateJson(host, tsconfigPath, (json) => {
        json.references ??= [];
        for (const remote of options.remotes) {
          const remotePath = `../${remote}`;
          if (!json.references.some((ref) => ref.path === remotePath))
            json.references.push({ path: remotePath });
        }
        return json;
      });
      updateJson(host, tsconfigRuntimePath, (json) => {
        json.references ??= [];
        for (const remote of options.remotes) {
          const remotePath = `../${remote}/tsconfig.app.json`;
          if (!json.references.some((ref) => ref.path === remotePath))
            json.references.push({ path: remotePath });
        }
        return json;
      });
    }
  }
}
