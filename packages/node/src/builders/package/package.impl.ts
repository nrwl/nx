import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { createProjectGraphAsync } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  updateBuildableProjectPackageJsonDependencies,
} from '@nrwl/workspace/src/utils/buildable-libs-utils';
import { from, Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { NodePackageBuilderOptions } from './utils/models';
import compileTypeScriptFiles from './utils/compile-typescript-files';
import updatePackageJson from './utils/update-package-json';
import normalizeOptions from './utils/normalize-options';
import copyAssetFiles from './utils/copy-asset-files';

export function runNodePackageBuilder(
  options: NodePackageBuilderOptions,
  context: BuilderContext
): Observable<{ success: boolean; outputPath?: string }> {
  return from(createProjectGraphAsync()).pipe(
    switchMap((projGraph) => {
      const libRoot = projGraph.nodes[context.target.project].data.root;
      const normalizedOptions = normalizeOptions(options, context, libRoot);
      const { target, dependencies } = calculateProjectDependencies(
        projGraph,
        context
      );
      const dependentProjectsHaveBeenBuilt = checkDependentProjectsHaveBeenBuilt(
        context,
        dependencies
      );
      if (dependentProjectsHaveBeenBuilt) {
        return compileTypeScriptFiles(
          normalizedOptions,
          context,
          libRoot,
          dependencies
        ).pipe(
          tap(() => {
            updatePackageJson(normalizedOptions, context);
            if (
              dependencies.length > 0 &&
              options.updateBuildableProjectDepsInPackageJson
            ) {
              updateBuildableProjectPackageJsonDependencies(
                context,
                target,
                dependencies
              );
            }
          }),
          switchMap(() => copyAssetFiles(normalizedOptions, context)),
          map((val) => ({
            ...val,
            outputPath: normalizedOptions.outputPath,
          }))
        );
      } else {
        return of({ success: false });
      }
    })
  );
}

export default createBuilder(runNodePackageBuilder);
