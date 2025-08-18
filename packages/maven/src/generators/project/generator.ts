import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  getWorkspaceLayout,
  names,
  offsetFromRoot,
  Tree,
} from '@nx/devkit';
import * as path from 'path';

export interface MavenProjectGeneratorSchema {
  name: string;
  directory?: string;
  groupId: string;
  artifactId: string;
  version?: string;
  packaging?: string;
  skipFormat?: boolean;
}

interface NormalizedSchema extends MavenProjectGeneratorSchema {
  projectName: string;
  projectRoot: string;
  projectDirectory: string;
  parsedTags: string[];
}

function normalizeOptions(
  tree: Tree,
  options: MavenProjectGeneratorSchema
): NormalizedSchema {
  const name = names(options.name).fileName;
  const projectDirectory = options.directory
    ? `${names(options.directory).fileName}/${name}`
    : name;
  const projectName = projectDirectory.replace(new RegExp('/', 'g'), '-');
  const projectRoot = `${getWorkspaceLayout(tree).appsDir}/${projectDirectory}`;

  return {
    ...options,
    projectName,
    projectRoot,
    projectDirectory,
    parsedTags: [],
    version: options.version || '1.0-SNAPSHOT',
    packaging: options.packaging || 'jar',
  };
}

function addFiles(tree: Tree, options: NormalizedSchema) {
  const templateOptions = {
    ...options,
    ...names(options.name),
    offsetFromRoot: offsetFromRoot(options.projectRoot),
    template: '',
  };

  generateFiles(
    tree,
    path.join(__dirname || '.', 'files'),
    options.projectRoot,
    templateOptions
  );
}

export async function mavenProjectGenerator(
  tree: Tree,
  options: MavenProjectGeneratorSchema
) {
  const normalizedOptions = normalizeOptions(tree, options);
  
  addProjectConfiguration(tree, normalizedOptions.projectName, {
    root: normalizedOptions.projectRoot,
    projectType: 'application',
    sourceRoot: `${normalizedOptions.projectRoot}/src/main/java`,
    targets: {
      compile: {
        executor: '@nx/maven:compile',
      },
      test: {
        executor: '@nx/maven:test',
      },
      package: {
        executor: '@nx/maven:package',
      },
    },
    tags: normalizedOptions.parsedTags,
  });
  
  addFiles(tree, normalizedOptions);
  
  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

export default mavenProjectGenerator;