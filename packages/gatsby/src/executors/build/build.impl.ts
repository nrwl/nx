import { fork } from 'child_process';
import { join } from 'path';
import { GatsbyPluginBuilderSchema } from './schema';
import { ExecutorContext } from '@nrwl/tao/src/shared/workspace';

export default async function buildExecutor(
  options: GatsbyPluginBuilderSchema,
  context: ExecutorContext
) {
  const projectRoot = context.workspace.projects[context.projectName].root;
  await runGatsbyBuild(context.root, projectRoot, context.projectName, options);

  return { success: true };
}

export function runGatsbyBuild(
  workspaceRoot: string,
  projectRoot: string,
  projectName: string,
  options: GatsbyPluginBuilderSchema
) {
  return new Promise<void>((resolve, reject) => {
    const cp = fork(
      require.resolve('gatsby-cli'),
      ['build', ...createGatsbyBuildOptions(options)],
      {
        cwd: join(workspaceRoot, projectRoot),
      }
    );

    // Ensure the child process is killed when the parent exits
    process.on('exit', () => cp.kill());
    process.on('SIGTERM', () => cp.kill());

    cp.on('error', (err) => {
      reject(err);
    });

    cp.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`Could not build "${projectName}". See errors above.`)
        );
      }
    });
  });
}

function createGatsbyBuildOptions(options: GatsbyPluginBuilderSchema) {
  return Object.keys(options).reduce((acc, k) => {
    const val = options[k];
    if (typeof val === 'undefined') return acc;
    switch (k) {
      case 'prefixPaths':
        return val ? acc.concat(`--prefix-paths`) : acc;
      case 'uglify':
        return val ? acc : acc.concat('--no-uglify');
      case 'color':
        return val ? acc : acc.concat('--no-color');
      case 'profile':
        return val ? acc.concat('--profile') : acc;
      case 'openTracingConfigFile':
        return val ? acc.concat([`--open-tracing-config-file`, val]) : acc;
      case 'graphqlTracing':
        return val ? acc.concat('--graphql-tracing') : acc;
      case 'serve':
      case 'host':
      case 'port':
      default:
        return acc;
    }
  }, []);
}
