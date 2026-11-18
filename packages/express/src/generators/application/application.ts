import type { GeneratorCallback, Tree } from '@nx/devkit';
import {
  determineProjectNameAndRootOptions,
  ensureRootProjectName,
} from '@nx/devkit/internal';
import {
  addDependenciesToPackageJson,
  formatFiles,
  runTasksInSerial,
  toJS,
  updateJson,
} from '@nx/devkit';
import { normalizeLinterOption, isUsingTsSolutionSetup } from '@nx/js/internal';
import { applicationGenerator as nodeApplicationGenerator } from '@nx/node';
import { tslibVersion } from '@nx/node/internal';
import { join } from 'path';
import { assertSupportedExpressVersion } from '../../utils/assert-supported-express-version';
import { nxVersion } from '../../utils/versions';
import { initGenerator } from '../init/init';
import type { LinterType } from '@nx/js';
import type { Schema } from './schema';

interface NormalizedSchema extends Schema {
  // `normalizeOptions` always resolves this, so it is no longer optional.
  linter: LinterType;
  appProjectName: string;
  appProjectRoot: string;
}

function addTypes(tree: Tree, options: NormalizedSchema) {
  updateJson(
    tree,
    join(options.appProjectRoot, 'tsconfig.app.json'),
    (json) => {
      json.compilerOptions.types = [...json.compilerOptions.types, 'express'];
      return json;
    }
  );
}

function addMainFile(tree: Tree, options: NormalizedSchema) {
  tree.write(
    join(options.appProjectRoot, `src/main.${options.js ? 'js' : 'ts'}`),
    `/**
 * This is not a production server yet!
 * This is only a minimal backend to get started.
 */

import express from 'express';
import * as path from 'path';

const app = express();

app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/api', (req, res) => {
  res.send({ message: 'Welcome to ${options.appProjectName}!' });
});

const port = process.env.PORT || 3333;
const server = app.listen(port, async (error${options.js ? '' : '?: Error'}) => {
  // A failed listen also reaches the 'error' listener below
  if (error) {
    return;
  }
  console.log(\`Listening at http://localhost:\${port}/api\`);
  // Set when Nx waits for this server to be ready
  if (process.env.NX_READY_SIGNAL_SOCKET) {
    try {
      // Function keeps TypeScript and bundlers from rewriting or bundling the import
      const load = new Function('s', 'return import(s)')${options.js ? '' : ' as (s: string) => Promise<{ emitReadySignal(server: unknown): boolean }>'};
      (await load('@nx/js/ready-signal')).emitReadySignal(server);
    } catch {
      // @nx/js isn't installed
    }
  }
});
server.on('error', (error) => {
  console.error(error);
  // Errors after listen, such as a failed accept, leave the server running
  if (!server.listening) {
    process.exit(1);
  }
});
`
  );

  if (options.js) {
    toJS(tree);
  }
}

export async function applicationGenerator(tree: Tree, schema: Schema) {
  return await applicationGeneratorInternal(tree, {
    useProjectJson: true,
    ...schema,
  });
}

export async function applicationGeneratorInternal(tree: Tree, schema: Schema) {
  assertSupportedExpressVersion(tree);

  const options = await normalizeOptions(tree, schema);

  const tasks: GeneratorCallback[] = [];
  const initTask = await initGenerator(tree, { ...options, skipFormat: true });
  tasks.push(initTask);
  const applicationTask = await nodeApplicationGenerator(tree, {
    ...options,
    bundler: 'webpack',
    framework: 'express',
    skipFormat: true,
  });
  tasks.push(applicationTask);
  addMainFile(tree, options);
  addTypes(tree, options);

  if (!options.skipPackageJson) {
    tasks.push(ensureDependencies(tree, options));
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...tasks);
}

export default applicationGenerator;

async function normalizeOptions(
  host: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  await ensureRootProjectName(options, 'application');
  const { projectName: appProjectName, projectRoot: appProjectRoot } =
    await determineProjectNameAndRootOptions(host, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
    });
  const useProjectJson =
    options.useProjectJson ?? !isUsingTsSolutionSetup(host);

  return {
    ...options,
    // Resolved after the spread so the type guarantees it downstream; this
    // generator forwards its options straight into `@nx/node:application`.
    linter: await normalizeLinterOption(host, options.linter),
    appProjectName,
    appProjectRoot,
    useProjectJson,
  };
}

function ensureDependencies(
  tree: Tree,
  options: NormalizedSchema
): GeneratorCallback {
  return addDependenciesToPackageJson(
    tree,
    { tslib: tslibVersion },
    { '@nx/express': nxVersion },
    undefined,
    options.keepExistingVersions ?? true
  );
}
