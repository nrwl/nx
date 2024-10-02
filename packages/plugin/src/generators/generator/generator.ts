import {
  formatFiles,
  GeneratorsJson,
  joinPathFragments,
  Tree,
  writeJson,
  generateFiles,
  names,
  readJson,
  readProjectConfiguration,
  updateJson,
} from '@nx/devkit';
import { PackageJson } from 'nx/src/utils/package-json';
import { hasGenerator } from '../../utils/has-generator';
import pluginLintCheckGenerator from '../lint-checks/generator';
import type { Schema } from './schema';
import { nxVersion } from '../../utils/versions';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { join, relative } from 'path';

type NormalizedSchema = Schema & {
  directory: string;
  fileName: string;
  className: string;
  propertyName: string;
  projectRoot: string;
  projectSourceRoot: string;
  project: string;
};

async function normalizeOptions(
  tree: Tree,
  options: Schema
): Promise<NormalizedSchema> {
  const { project, fileName, artifactName, filePath, directory } =
    await determineArtifactNameAndDirectoryOptions(tree, {
      name: options.name,
      path: options.path,
      fileName: 'generator',
    });

  const { className, propertyName } = names(artifactName);

  const { root: projectRoot, sourceRoot: projectSourceRoot } =
    readProjectConfiguration(tree, project);

  let description: string;
  if (options.description) {
    description = options.description;
  } else {
    description = `${options.name} generator`;
  }

  return {
    ...options,
    directory,
    project,
    fileName,
    className,
    propertyName,
    description,
    projectRoot,
    projectSourceRoot,
  };
}

function addFiles(host: Tree, options: NormalizedSchema) {
  const indexPath = join(options.path, 'files/src/index.ts.template');

  if (!host.exists(indexPath)) {
    host.write(indexPath, 'const variable = "<%= name %>";');
  }

  generateFiles(host, join(__dirname, './files/generator'), options.path, {
    ...options,
    generatorFnName: `${options.propertyName}Generator`,
    schemaInterfaceName: `${options.className}GeneratorSchema`,
  });

  if (options.unitTestRunner === 'none') {
    host.delete(join(options.path, `generator.spec.ts`));
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
  // add dependencies
  updateJson<PackageJson>(
    host,
    joinPathFragments(options.projectRoot, 'package.json'),
    (json) => {
      json.dependencies = {
        '@nx/devkit': nxVersion,
        ...json.dependencies,
      };
      return json;
    }
  );

  updateJson<GeneratorsJson>(host, generatorsPath, (json) => {
    let generators = json.generators ?? json.schematics;
    generators = generators || {};
    generators[options.name] = {
      factory: `./${joinPathFragments(
        relative(options.projectRoot, options.path),
        'generator'
      )}`,
      schema: `./${joinPathFragments(
        relative(options.projectRoot, options.path),
        'schema.json'
      )}`,
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
  const options = await normalizeOptions(host, schema);
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
