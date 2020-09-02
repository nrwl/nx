import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  scheduleTargetAndForget,
  targetFromTargetString,
} from '@angular-devkit/architect';
import exportApp from 'next/dist/export';
import { PHASE_EXPORT } from 'next/dist/next-server/lib/constants';
import * as path from 'path';
import { from, Observable, of } from 'rxjs';
import { concatMap, map } from 'rxjs/operators';
import { prepareConfig } from '../../utils/config';
import {
  NextBuildBuilderOptions,
  NextExportBuilderOptions,
} from '../../utils/types';

try {
  require('dotenv').config();
} catch (e) {}

export default createBuilder<NextExportBuilderOptions>(run);

function run(
  options: NextExportBuilderOptions,
  context: BuilderContext
): Observable<BuilderOutput> {
  const buildTarget = targetFromTargetString(options.buildTarget);
  const build$ = scheduleTargetAndForget(context, buildTarget);

  return build$.pipe(
    concatMap((r) => {
      if (!r.success) return of(r);
      return from(context.getTargetOptions(buildTarget)).pipe(
        concatMap((buildOptions: NextBuildBuilderOptions) => {
          const root = path.resolve(context.workspaceRoot, buildOptions.root);
          const config = prepareConfig(PHASE_EXPORT, buildOptions, context);
          return from(
            exportApp(
              root,
              {
                statusMessage: 'Exporting',
                silent: options.silent,
                threads: options.threads,
                outdir: `${buildOptions.outputPath}/exported`,
              } as any,
              config
            )
          ).pipe(map(() => ({ success: true })));
        })
      );
    })
  );
}
