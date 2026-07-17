import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  generateFiles,
  GeneratorCallback,
  readProjectConfiguration,
  readProjectsConfigurationFromProjectGraph,
  runTasksInSerial,
  updateJson,
  type Tree,
} from '@nx/devkit';
import { type Schema } from './schema';
import { normalizeOptions } from './lib';
import { initGenerator as jsInitGenerator } from '@nx/js';
import { initGenerator } from '../init/init';
import {
  getInstalledRsbuildMajorVersion,
  getRsbuildVersionsForInstalledMajor,
} from '../../utils/version-utils';
import { assertSupportedRsbuildVersion } from '../../utils/assert-supported-rsbuild-version';
import { join } from 'path';

export async function configurationGenerator(tree: Tree, schema: Schema) {
  assertSupportedRsbuildVersion(tree);

  const projectGraph = await createProjectGraphAsync();
  const projects = readProjectsConfigurationFromProjectGraph(projectGraph);
  let project = projects.projects[schema.project];
  if (!project) {
    project = readProjectConfiguration(tree, schema.project);
    if (!project) {
      throw new Error(
        `Could not find project '${schema.project}'. Please choose a project that exists in the Nx Workspace.`
      );
    }
  }

  const options = await normalizeOptions(tree, schema, project);
  const tasks: GeneratorCallback[] = [];

  const jsInitTask = await jsInitGenerator(tree, {
    ...schema,
    skipFormat: true,
    tsConfigName:
      options.projectRoot === '.' ? 'tsconfig.json' : 'tsconfig.base.json',
  });
  tasks.push(jsInitTask);
  const initTask = await initGenerator(tree, { skipFormat: true });
  tasks.push(initTask);

  if (options.skipValidation) {
    const projectJson = readProjectConfiguration(tree, project.name);
    if (projectJson.targets['build']) {
      delete projectJson.targets['build'];
    }
    if (projectJson.targets['serve']) {
      delete projectJson.targets['serve'];
    }
    if (projectJson.targets['dev']) {
      delete projectJson.targets['dev'];
    }
  }

  const rsbuildVersions = getRsbuildVersionsForInstalledMajor(tree);
  tasks.push(
    addDependenciesToPackageJson(
      tree,
      {},
      { '@rsbuild/core': rsbuildVersions.rsbuildVersion },
      undefined,
      true
    )
  );

  // @rsbuild/core@2 emits ESM output by default for both web and Node
  // targets. There are two ways to make that output runnable:
  //   1. `"type": "module"` on the project package.json — rsbuild's own
  //      `create-rsbuild` convention. Used when the project owns a
  //      package.json (fabricating one, or landing `type` on the
  //      workspace root, would flip every .js file in the repo to ESM).
  //   2. `.mjs` output filenames — used for Node builds when the
  //      project has no package.json to carry `"type": "module"`.
  //      `.mjs` is unconditionally ESM regardless of the nearest
  //      package.json. Web output doesn't need this; the browser loads
  //      it via `<script type="module">`.
  // Both are v2-only — on v1 rsbuild still emits CommonJS.
  const installedRsbuildMajor = getInstalledRsbuildMajorVersion(tree);
  const isV2 =
    installedRsbuildMajor === undefined || installedRsbuildMajor >= 2;
  const projectPackageJsonPath = join(options.projectRoot, 'package.json');
  const projectHasPackageJson = tree.exists(projectPackageJsonPath);
  const useMjsOutput =
    isV2 && options.target === 'node' && !projectHasPackageJson;

  generateFiles(tree, join(__dirname, 'files'), options.projectRoot, {
    ...options,
    useMjsOutput,
    tpl: '',
  });

  if (isV2 && projectHasPackageJson) {
    updateJson(tree, projectPackageJsonPath, (json) => {
      json.type ??= 'module';
      return json;
    });
  }

  return runTasksInSerial(...tasks);
}

export default configurationGenerator;
