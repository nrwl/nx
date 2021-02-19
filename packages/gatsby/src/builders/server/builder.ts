import {
  BuilderContext,
  BuilderOutput,
  createBuilder,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { fork } from 'child_process';
import { join } from 'path';
import { from, Observable, of } from 'rxjs';
import { catchError, concatMap, withLatestFrom } from 'rxjs/operators';
import { GatsbyPluginBuilderSchema } from './schema';
import { runGatsbyBuild } from '../build/builder';
import { GatsbyPluginBuilderSchema as BuildBuilderSchema } from '../build/schema';
import { getProjectRoot } from '../../utils/get-project-root';

export function runBuilder(
  options: GatsbyPluginBuilderSchema,
  context: BuilderContext
): Observable<BuilderOutput> {
  const buildTarget = targetFromTargetString(options.buildTarget);
  const baseUrl = `${options.https ? 'https' : 'http'}://${options.host}:${
    options.port
  }`;
  return from(getProjectRoot(context)).pipe(
    concatMap((projectRoot) => {
      return from(context.getTargetOptions(buildTarget)).pipe(
        concatMap((buildOptions: BuildBuilderSchema) => {
          return new Observable<BuilderOutput>((subscriber) => {
            if (context.target.configuration === 'production') {
              runGatsbyBuild(context.workspaceRoot, projectRoot, buildOptions)
                .then(() =>
                  runGatsbyServe(context.workspaceRoot, projectRoot, options)
                )
                .then(() => {
                  subscriber.next({
                    success: true,
                  });
                })
                .catch((err) => {
                  context.logger.error('Error during serve', err);
                });
            } else {
              runGatsbyDevelop(
                context.workspaceRoot,
                projectRoot,
                createGatsbyOptions(options)
              )
                .then((success) => {
                  subscriber.next({
                    baseUrl,
                    success,
                  });
                })
                .catch((err) => {
                  context.logger.error('Error during serve', err?.message);
                  subscriber.next({
                    success: false,
                  });
                  subscriber.complete();
                });
            }
          });
        }),
        catchError((err) => {
          context.logger.error(err);
          return of({ success: false });
        })
      );
    })
  );
}

function createGatsbyOptions(options) {
  return Object.keys(options).reduce((acc, k) => {
    if (k === 'port' || k === 'host' || k === 'https' || k === 'open')
      acc.push(`--${k}=${options[k]}`);
    return acc;
  }, []);
}

async function runGatsbyDevelop(workspaceRoot, projectRoot, options) {
  return new Promise<boolean>((resolve, reject) => {
    const cp = fork(require.resolve('gatsby-cli'), ['develop', ...options], {
      cwd: join(workspaceRoot, projectRoot),
      env: {
        ...process.env,
      },
      stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
    });

    // Ensure the child process is killed when the parent exits
    process.on('exit', () => cp.kill());

    cp.on('message', ({ action }) => {
      if (
        action?.type === 'ACTIVITY_END' &&
        action?.payload?.status === 'SUCCESS' &&
        action?.payload?.id === 'webpack-develop'
      ) {
        resolve(true);
      }
    });

    cp.on('error', (err) => {
      reject(err);
    });

    cp.on('exit', (code) => {
      if (code !== 0) {
        reject(code);
      }
    });
  });
}

function runGatsbyServe(
  workspaceRoot: string,
  projectRoot: string,
  options: GatsbyPluginBuilderSchema
) {
  return new Promise((resolve, reject) => {
    const cp = fork(
      require.resolve('gatsby-cli'),
      ['serve', ...createGatsbyServeOptions(options)],
      { cwd: join(workspaceRoot, projectRoot) }
    );

    cp.on('error', (err) => {
      reject(err);
    });

    cp.on('exit', (code) => {
      if (code === 0) {
        resolve(code);
      } else {
        reject(code);
      }
    });
  });
}

function createGatsbyServeOptions(options: GatsbyPluginBuilderSchema) {
  return Object.keys(options).reduce((acc, k) => {
    const val = options[k];
    if (typeof val === 'undefined') return acc;
    switch (k) {
      case 'host':
        return val ? acc.concat([`--host`, val]) : acc;
      case 'open':
        return val ? acc.concat(`--open`) : acc;
      case 'prefixPaths':
        return val ? acc.concat(`--prefix-paths`) : acc;
      case 'port':
        return val ? acc.concat([`--port`, val]) : acc;
      default:
        return acc;
    }
  }, []);
}

export default createBuilder(runBuilder);
