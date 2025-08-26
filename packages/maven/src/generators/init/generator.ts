import {
  addDependenciesToPackageJson,
  formatFiles,
  GeneratorCallback,
  Tree,
  logger,
} from '@nx/devkit';
import { DOMParser, XMLSerializer } from 'xmldom';

export interface MavenInitGeneratorSchema {
  skipFormat?: boolean;
}

export async function mavenInitGenerator(
  tree: Tree,
  options: MavenInitGeneratorSchema
) {
  const tasks: GeneratorCallback[] = [];

  // Add Maven-related dependencies if needed
  const installTask = addDependenciesToPackageJson(
    tree,
    {},
    {
      '@nx/maven': 'latest',
    }
  );
  tasks.push(installTask);

  // Add nx-maven-analyzer plugin to root pom.xml if it exists
  addNxMavenAnalyzerPlugin(tree);

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return async () => {
    for (const task of tasks) {
      await task();
    }
  };
}

function addNxMavenAnalyzerPlugin(tree: Tree) {
  const rootPomPath = 'pom.xml';
  
  if (!tree.exists(rootPomPath)) {
    logger.warn('Root pom.xml not found, skipping nx-maven-analyzer plugin addition');
    return;
  }

  const pomContent = tree.read(rootPomPath, 'utf-8');
  if (!pomContent) {
    logger.warn('Unable to read root pom.xml content');
    return;
  }

  // Check if plugin is already present
  if (pomContent.includes('dev.nx.maven') && pomContent.includes('nx-maven-analyzer-plugin')) {
    logger.info('nx-maven-analyzer plugin already present in pom.xml');
    return;
  }

  const updatedPomContent = addPluginToPom(pomContent);
  if (updatedPomContent !== pomContent) {
    tree.write(rootPomPath, updatedPomContent);
    logger.info('Added nx-maven-analyzer plugin to root pom.xml');
  }
}

function addPluginToPom(pomContent: string): string {
  try {
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const doc = parser.parseFromString(pomContent, 'application/xml');
    
    const project = doc.getElementsByTagName('project')[0];
    if (!project) {
      logger.warn('Could not find <project> element in pom.xml');
      return pomContent;
    }

    // Find or create <build> element
    let build = project.getElementsByTagName('build')[0];
    if (!build) {
      build = doc.createElement('build');
      project.appendChild(doc.createTextNode('\n  '));
      project.appendChild(build);
      project.appendChild(doc.createTextNode('\n'));
    }

    // Find or create <plugins> element
    let plugins = build.getElementsByTagName('plugins')[0];
    if (!plugins) {
      plugins = doc.createElement('plugins');
      build.appendChild(doc.createTextNode('\n    '));
      build.appendChild(plugins);
      build.appendChild(doc.createTextNode('\n  '));
    }

    // Create the nx-maven-analyzer plugin element
    const plugin = doc.createElement('plugin');
    
    const groupId = doc.createElement('groupId');
    groupId.appendChild(doc.createTextNode('dev.nx.maven'));
    plugin.appendChild(doc.createTextNode('\n        '));
    plugin.appendChild(groupId);
    
    const artifactId = doc.createElement('artifactId');
    artifactId.appendChild(doc.createTextNode('nx-maven-analyzer-plugin'));
    plugin.appendChild(doc.createTextNode('\n        '));
    plugin.appendChild(artifactId);
    
    const version = doc.createElement('version');
    version.appendChild(doc.createTextNode('0.0.1-SNAPSHOT'));
    plugin.appendChild(doc.createTextNode('\n        '));
    plugin.appendChild(version);
    plugin.appendChild(doc.createTextNode('\n      '));

    // Add plugin to plugins element
    plugins.appendChild(doc.createTextNode('\n      '));
    plugins.appendChild(plugin);
    plugins.appendChild(doc.createTextNode('\n    '));

    return serializer.serializeToString(doc);
  } catch (error) {
    logger.error(`Failed to parse or modify pom.xml: ${error instanceof Error ? error.message : error}`);
    return pomContent;
  }
}

export default mavenInitGenerator;