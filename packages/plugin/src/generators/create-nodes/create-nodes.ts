import {
  formatFiles,
  generateFiles,
  joinPathFragments,
  names,
  readJson,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { determineArtifactNameAndDirectoryOptions } from '@nx/devkit/src/generators/artifact-name-and-directory-utils';
import { isUsingTsSolutionSetup } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { join } from 'path';
import { PackageJson } from 'nx/src/utils/package-json';
import type { CreateNodesGeneratorSchema } from './schema';

interface NormalizedSchema extends CreateNodesGeneratorSchema {
  className: string;
  propertyName: string;
  projectRoot: string;
  projectSourceRoot: string;
  fileName: string;
  directory: string;
  project: string;
  isTsSolutionSetup: boolean;
  importPath: string;
}

function addFiles(host: Tree, options: NormalizedSchema) {
  generateFiles(host, join(__dirname, './files/plugin'), options.directory, {
    ...options,
  });
}

function addReadmeFile(host: Tree, options: NormalizedSchema) {
  if (options.skipReadme) {
    return;
  }

  const readmePath = joinPathFragments(options.projectRoot, 'README.md');
  const readmeExists = host.exists(readmePath);

  if (!readmeExists) {
    // Create new README
    generateFiles(host, join(__dirname, './files'), options.projectRoot, {
      ...options,
      tmpl: '',
    });
  } else {
    // Append to existing README
    const existingContent = host.read(readmePath, 'utf-8');
    const separator = '\n\n---\n\n';

    // Check if the content already exists to avoid duplicates
    if (existingContent.includes('## What is an Inference Plugin?')) {
      return;
    }

    // Generate to a temp directory to get the processed content
    const tempDir = '.nx-temp-readme';
    generateFiles(host, join(__dirname, './files'), tempDir, {
      ...options,
      tmpl: '',
    });

    const tempReadmePath = joinPathFragments(tempDir, 'README.md');
    const newContent = host.read(tempReadmePath, 'utf-8');

    // Clean up temp directory
    host.delete(tempDir);

    // Append to existing README
    host.write(readmePath, existingContent + separator + newContent);
  }
}

async function normalizeOptions(
  tree: Tree,
  options: CreateNodesGeneratorSchema
): Promise<NormalizedSchema> {
  const {
    artifactName: name,
    directory: initialDirectory,
    fileName,
    project,
  } = await determineArtifactNameAndDirectoryOptions(tree, {
    path: options.path,
    name: options.name,
    allowedFileExtensions: ['ts'],
    fileExtension: 'ts',
  });

  // Check if the path looks like a directory path (doesn't end with a filename)
  // If so, include the artifact name as a subdirectory
  let directory = initialDirectory;
  const normalizedPath = options.path.replace(/^\.?\//, '').replace(/\/$/, '');
  const pathSegments = normalizedPath.split('/');
  const lastSegment = pathSegments[pathSegments.length - 1];

  // If the last segment doesn't end with a known file extension and matches the artifact name,
  // it's likely a directory path, so we should create a subdirectory
  const knownFileExtensions = ['.ts', '.js', '.jsx', '.tsx'];
  const hasKnownFileExtension = knownFileExtensions.some((ext) =>
    lastSegment.endsWith(ext)
  );
  if (!hasKnownFileExtension && lastSegment === name) {
    directory = joinPathFragments(initialDirectory, name);
  }

  const { className, propertyName } = names(name);

  const { root: projectRoot, sourceRoot: projectSourceRoot } =
    readProjectConfiguration(tree, project);

  // Get the import path from package.json
  const packageJson = readJson<PackageJson>(
    tree,
    joinPathFragments(projectRoot, 'package.json')
  );
  const importPath = packageJson.name;

  return {
    ...options,
    fileName,
    project,
    directory,
    name,
    className,
    propertyName,
    projectRoot,
    projectSourceRoot: projectSourceRoot ?? join(projectRoot, 'src'),
    isTsSolutionSetup: isUsingTsSolutionSetup(tree),
    targetName: options.targetName ?? 'echo',
    configFile: options.configFile ?? '**/.my-plugin-config.json',
    importPath,
  };
}

export async function createNodesGenerator(
  tree: Tree,
  schema: CreateNodesGeneratorSchema
) {
  const options = await normalizeOptions(tree, schema);

  addFiles(tree, options);
  addReadmeFile(tree, options);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default createNodesGenerator;
