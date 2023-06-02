import {
  formatFiles,
  GeneratorsJson,
  joinPathFragments,
  Tree,
  writeJson,
  convertNxGenerator,
  generateFiles,
  getWorkspaceLayout,
  names,
  readJson,
  readProjectConfiguration,
  updateJson,
} from '@nx/devkit';
import { PackageJson } from 'nx/src/utils/package-json';
import * as path from 'path';
import { hasGenerator } from '../../utils/has-generator';
import pluginLintCheckGenerator from '../lint-checks/generator';
import type { Schema } from './schema';

type NormalizedSchema = Schema &
  ReturnType<typeof names> & {
    fileName: string;
    className: string;
    projectRoot: string;
    projectSourceRoot: string;
    npmScope: string;
    npmPackageName: string;
  };

function normalizeOptions(host: Tree, options: Schema): NormalizedSchema {
  const { npmScope } = getWorkspaceLayout(host);

  const { root: projectRoot, sourceRoot: projectSourceRoot } =
    readProjectConfiguration(host, options.project);

  const npmPackageName = readJson<{ name: string }>(
    host,
    path.join(projectRoot, 'package.json')
  ).name;

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = `${options.name} generator`;
  }

  return {
    ...options,
    ...names(options.name),
    description,
    projectRoot,
    projectSourceRoot,
    npmScope,
    npmPackageName,
  };
}

function addFiles(host: Tree, options: NormalizedSchema) {
  const indexPath = `${options.projectSourceRoot}/generators/${options.fileName}/files/src/index.ts.template`;

  if (!host.exists(indexPath)) {
    host.write(indexPath, 'const variable = "<%= name %>";');
  }

  generateFiles(
    host,
    path.join(__dirname, './files/generator'),
    `${options.projectSourceRoot}/generators`,
    {
      ...options,
      generatorFnName: `${options.propertyName}Generator`,
      schemaInterfaceName: `${options.className}GeneratorSchema`,
    }
  );

  if (options.unitTestRunner === 'none') {
    host.delete(
      path.join(
        options.projectSourceRoot,
        'generators',
        options.fileName,
        `generator.spec.ts`
      )
    );
  }
}

export async function createGeneratorsJson(
  host: Tree,
  projectRoot: string,
  projectName: string,
  skipLintChecks?: boolean,
  skipFormat?: boolean
) {
  updateJson<PackageJson>(
    host,
    joinPathFragments(projectRoot, 'package.json'),
    (json) => {
      json.generators ??= './generators.json';
      return json;
    }
  );
  writeJson<GeneratorsJson>(
    host,
    joinPathFragments(projectRoot, 'generators.json'),
    {
      generators: {},
    }
  );
  if (!skipLintChecks) {
    await pluginLintCheckGenerator(host, {
      projectName,
      skipFormat,
    });
  }
}

async function updateGeneratorJson(host: Tree, options: NormalizedSchema) {
  const packageJson = readJson<PackageJson>(
    host,
    joinPathFragments(options.projectRoot, 'package.json')
  );
  const packageJsonGenerators =
    packageJson.generators ?? packageJson.schematics;
  let generatorsPath = packageJsonGenerators
    ? joinPathFragments(options.projectRoot, packageJsonGenerators)
    : null;

  if (!generatorsPath) {
    generatorsPath = joinPathFragments(options.projectRoot, 'generators.json');
  }
  if (!host.exists(generatorsPath)) {
    await createGeneratorsJson(
      host,
      options.projectRoot,
      options.project,
      options.skipLintChecks,
      options.skipFormat
    );
  }

  updateJson<GeneratorsJson>(host, generatorsPath, (json) => {
    let generators = json.generators ?? json.schematics;
    generators = generators || {};
    generators[options.name] = {
      factory: `./src/generators/${options.fileName}/generator`,
      schema: `./src/generators/${options.fileName}/schema.json`,
      description: options.description,
    };
    // @todo(v17): Remove this, prop is defunct.
    if (options.name === 'preset') {
      generators[options.name]['x-use-standalone-layout'] = true;
    }
    json.generators = generators;
    return json;
  });
}

export async function generatorGenerator(host: Tree, schema: Schema) {
  const options = normalizeOptions(host, schema);
  if (hasGenerator(host, options.project, options.name)) {
    throw new Error(`Generator ${options.name} already exists.`);
  }

  addFiles(host, options);

  await updateGeneratorJson(host, options);

  if (!options.skipFormat) {
    await formatFiles(host);
  }
}

export default generatorGenerator;
export const generatorSchematic = convertNxGenerator(generatorGenerator);
