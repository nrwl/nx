import { ExecutorContext, logger } from '@nrwl/devkit';
import { exec, execSync } from 'child_process';
import { EMPTY, Observable, zip } from 'rxjs';
import { concatMap, map, tap } from 'rxjs/operators';
import { normalizeTsCompilationOptions } from '../normalize-ts-compilation-options';
import { NormalizedSwcExecutorOptions } from '../schema';
import { printDiagnostics } from '../typescript/print-diagnostics';
import {
  runTypeCheck,
  runTypeCheckWatch,
  TypeCheckOptions,
} from '../typescript/run-type-check';

export function compileSwc(
  context: ExecutorContext,
  normalizedOptions: NormalizedSwcExecutorOptions,
  postCompilationCallback: () => Promise<void>
) {
  const tsOptions = {
    outputPath: normalizedOptions.outputPath,
    projectName: context.projectName,
    projectRoot: normalizedOptions.projectRoot,
    tsConfig: normalizedOptions.tsConfig,
    watch: normalizedOptions.watch,
  };
  const outDir = tsOptions.outputPath.replace(`/${tsOptions.projectRoot}`, '');

  const normalizedTsOptions = normalizeTsCompilationOptions(tsOptions);
  logger.log(`Compiling with SWC for ${normalizedTsOptions.projectName}...`);
  const srcPath = normalizedTsOptions.projectRoot;
  const destPath = normalizedTsOptions.outputPath.replace(
    `/${normalizedTsOptions.projectName}`,
    ''
  );
  let swcCmd = `npx swc ${srcPath} -d ${destPath} --source-maps --config-file=${normalizedOptions.swcrcPath}`;

  const postCompilationOperator = () =>
    concatMap(({ success }) => {
      if (success) {
        return postCompilationCallback().then(() => ({ success }));
      }
      return EMPTY;
    });

  const compile$ = new Observable<{ success: boolean }>((subscriber) => {
    if (normalizedOptions.watch) {
      swcCmd += ' --watch';
      const watchProcess = createSwcWatchProcess(swcCmd, (success) => {
        subscriber.next({ success });
      });

      return () => {
        watchProcess.close();
        subscriber.complete();
      };
    }

    const swcCmdLog = execSync(swcCmd).toString();
    logger.log(swcCmdLog.replace(/\n/, ''));
    subscriber.next({ success: swcCmdLog.includes('Successfully compiled') });

    return () => {
      subscriber.complete();
    };
  });

  if (normalizedOptions.skipTypeCheck) {
    return compile$.pipe(postCompilationOperator());
  }

  const typeCheck$ = new Observable<{ success: boolean }>((subscriber) => {
    const typeCheckOptions: TypeCheckOptions = {
      mode: 'emitDeclarationOnly',
      tsConfigPath: tsOptions.tsConfig,
      outDir,
      workspaceRoot: normalizedOptions.root,
    };
    if (normalizedOptions.watch) {
      let typeCheckRunner: { close: () => void };
      let preEmit = false;
      runTypeCheckWatch(
        typeCheckOptions,
        (diagnostic, formattedDiagnostic, errorCount) => {
          // 6031 and 6032 are to skip watchCompilerHost initialization (Start watching for changes... message)
          // We also skip if preEmit has been set to true, because it means that the first type check before
          // the WatchCompiler emits.
          if (preEmit && diagnostic.code !== 6031 && diagnostic.code !== 6032) {
            const hasErrors = errorCount > 0;
            if (hasErrors) {
              void printDiagnostics([formattedDiagnostic]);
            } else {
              void printDiagnostics([], [formattedDiagnostic]);
            }
            subscriber.next({ success: !hasErrors });
          }
        }
      ).then(({ close, preEmitErrors, preEmitWarnings }) => {
        const hasErrors = preEmitErrors.length > 0;
        if (hasErrors) {
          void printDiagnostics(preEmitErrors, preEmitWarnings);
        }
        typeCheckRunner = { close };
        subscriber.next({ success: !hasErrors });
        preEmit = true;
      });

      return () => {
        if (typeCheckRunner) {
          typeCheckRunner.close();
        }
        subscriber.complete();
      };
    }

    runTypeCheck(typeCheckOptions).then(({ errors, warnings }) => {
      const hasErrors = errors.length > 0;
      if (hasErrors) {
        void printDiagnostics(errors, warnings);
      }
      subscriber.next({ success: !hasErrors });
      subscriber.complete();
    });

    return () => {
      subscriber.complete();
    };
  });

  return zip(compile$, typeCheck$).pipe(
    map(([compileResult, typeCheckResult]) => ({
      success: compileResult.success && typeCheckResult.success,
    })),
    postCompilationOperator()
  );
}

function createSwcWatchProcess(
  swcCmd: string,
  callback: (success: boolean) => void
) {
  const watchProcess = exec(swcCmd);

  watchProcess.stdout.on('data', (data) => {
    process.stdout.write(data);
    callback(data.includes('Successfully compiled'));
  });

  watchProcess.stderr.on('data', (err) => {
    process.stderr.write(err);
    callback(false);
  });

  const processExitListener = () => watchProcess.kill();

  process.on('SIGINT', processExitListener);
  process.on('SIGTERM', processExitListener);
  process.on('exit', processExitListener);

  watchProcess.on('exit', () => {
    callback(true);
  });

  return { close: () => watchProcess.kill() };
}
