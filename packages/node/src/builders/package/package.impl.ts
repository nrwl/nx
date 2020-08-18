import { BuilderContext, createBuilder } from '@angular-devkit/architect';
import { createProjectGraph } from '@nrwl/workspace/src/core/project-graph';
import {
  calculateProjectDependencies,
  checkDependentProjectsHaveBeenBuilt,
  updateBuildableProjectPackageJsonDependencies,
} from '@nrwl/workspace/src/utils/buildable-libs-utils';
import { of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { NodePackageBuilderOptions } from './utils/models';
import compileTypeScriptFiles from './utils/compile-typescript-files';
import updatePackageJson from './utils/update-package-json';
import normalizeOptions from './utils/normalize-options';
import copyAssetFiles from './utils/copy-asset-files';

export function runNodePackageBuilder(
  options: NodePackageBuilderOptions,
  context: BuilderContext
) {
  const projGraph = createProjectGraph();
  const libRoot = projGraph.nodes[context.target.project].data.root;
  const normalizedOptions = normalizeOptions(options, context, libRoot);
  const { target, dependencies } = calculateProjectDependencies(
    projGraph,
    context
  );

  return of(checkDependentProjectsHaveBeenBuilt(context, dependencies)).pipe(
    switchMap((result) => {
      if (result) {
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
          switchMap(() => copyAssetFiles(normalizedOptions, context))
        );
      } else {
        return of({ success: false });
      }
    }),
    map((value) => {
      return {
        ...value,
        outputPath: normalizedOptions.outputPath,
      };
    })
  );
}

export default createBuilder(runNodePackageBuilder);
