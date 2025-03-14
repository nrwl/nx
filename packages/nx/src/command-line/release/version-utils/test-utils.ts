import TOML from '@ltd/j-toml';
import { join } from 'node:path';
import type { NxJsonConfiguration } from '../../../config/nx-json';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import { writeJson } from '../../../generators/utils/json';
import { createProjectFileMapUsingProjectGraph } from '../../../project-graph/file-map-utils';
import { createNxReleaseConfig, NxReleaseConfig } from '../config/config';
import { filterReleaseGroups } from '../config/filter-release-groups';
import { ReleaseVersionGeneratorSchema } from '../version';
import { ManifestActions, ManifestData } from './flexible-version-management';

export async function createNxReleaseConfigAndPopulateWorkspace(
  tree: Tree,
  graphDefinition: string,
  additionalNxReleaseConfig: Exclude<NxJsonConfiguration['release'], 'groups'>,
  mockResolveCurrentVersion?: any,
  filters: {
    projects?: string[];
    groups?: string[];
  } = {}
) {
  const graph = parseGraphDefinition(graphDefinition);
  const { groups, projectGraph } = setupGraph(tree, graph);

  const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
    projectGraph,
    await createProjectFileMapUsingProjectGraph(projectGraph),
    {
      ...additionalNxReleaseConfig,
      groups,
    }
  );
  if (configError) {
    throw configError;
  }

  let {
    error: filterError,
    releaseGroups,
    releaseGroupToFilteredProjects,
  } = filterReleaseGroups(
    projectGraph,
    nxReleaseConfig!,
    filters.projects,
    filters.groups
  );
  if (filterError) {
    throw filterError;
  }

  // Mock the implementation of resolveCurrentVersion to reliably return the version of the project based on our graph definition
  mockResolveCurrentVersion?.mockImplementation((_, { name }) => {
    for (const [projectName, project] of Object.entries(graph.projects)) {
      if (projectName === name) {
        return (project as any).version;
      }
    }
    throw new Error(`Unknown project name in test utils: ${name}`);
  });

  return {
    projectGraph,
    nxReleaseConfig: nxReleaseConfig!,
    releaseGroups,
    releaseGroupToFilteredProjects,
    filters,
  };
}

/**
 * A non-production grade rust implementation to prove out loading multiple different manifestActions in various setups
 */
interface CargoToml {
  workspace?: { members: string[] };
  package: { name: string; version: string };
  dependencies?: Record<
    string,
    string | { version: string; features?: string[]; optional?: boolean }
  >;
  'dev-dependencies'?: Record<
    string,
    string | { version: string; features: string[] }
  >;
  [key: string]: any;
}

export class ExampleRustManifestActions extends ManifestActions {
  manifestFilename = 'Cargo.toml';

  private parseCargoToml(cargoString: string): CargoToml {
    return TOML.parse(cargoString, {
      x: { comment: true },
    }) as CargoToml;
  }

  static stringifyCargoToml(cargoToml: CargoToml): string {
    const tomlString = TOML.stringify(cargoToml, {
      newlineAround: 'section',
    });
    return Array.isArray(tomlString) ? tomlString.join('\n') : tomlString;
  }

  static modifyCargoTable(
    toml: CargoToml,
    section: string,
    key: string,
    value: string | object | Array<any> | (() => any)
  ) {
    toml[section] ??= TOML.Section({});
    toml[section][key] =
      typeof value === 'object' && !Array.isArray(value)
        ? TOML.inline(value as any)
        : typeof value === 'function'
        ? value()
        : value;
  }

  async readSourceManifestData(tree: Tree): Promise<ManifestData> {
    const cargoTomlPath = join(this.projectGraphNode.data.root, 'Cargo.toml');
    const cargoTomlString = tree.read(cargoTomlPath, 'utf-8')!.toString();
    const cargoToml = this.parseCargoToml(cargoTomlString);

    const currentVersion = cargoToml.package?.version || '0.0.0';
    const name = cargoToml.package?.name || 'unknown';

    const dependencies: ManifestData['dependencies'] = {
      dependencies: {},
    };

    if (cargoToml.dependencies) {
      for (const [dep, version] of Object.entries(cargoToml.dependencies)) {
        const resolvedVersion =
          typeof version === 'string' ? version : version.version;
        dependencies.dependencies[dep] = {
          resolvedVersion,
          rawVersionSpec: resolvedVersion,
        };
      }
    }

    return {
      name,
      currentVersion,
      dependencies,
    };
  }

  async readCurrentVersionFromSourceManifest(tree: Tree): Promise<string> {
    return (await this.readSourceManifestData(tree)).currentVersion;
  }

  async readCurrentVersionFromRegistry(
    tree: Tree,
    _currentVersionResolverMetadata: ReleaseVersionGeneratorSchema['currentVersionResolverMetadata']
  ): Promise<{
    currentVersion: string;
    logText: string;
  }> {
    // Real registry resolver not needed for this test example
    return {
      currentVersion: await this.readCurrentVersionFromSourceManifest(tree),
      logText: 'https://example.com/fake-registry',
    };
  }

  async writeVersionToManifests(tree: Tree, newVersion: string) {
    for (const manifestPath of this.manifestsToUpdate) {
      const cargoTomlString = tree.read(manifestPath, 'utf-8')!.toString();
      const cargoToml = this.parseCargoToml(cargoTomlString);
      ExampleRustManifestActions.modifyCargoTable(
        cargoToml,
        'package',
        'version',
        newVersion
      );
      const updatedCargoTomlString =
        ExampleRustManifestActions.stringifyCargoToml(cargoToml);
      tree.write(manifestPath, updatedCargoTomlString);
    }
  }

  async getCurrentVersionOfDependency(
    tree: Tree,
    _projectGraph: ProjectGraph,
    dependencyProjectName: string
  ): Promise<{ currentVersion: string; dependencyCollection: string }> {
    const cargoTomlPath = join(this.projectGraphNode.data.root, 'Cargo.toml');
    const cargoTomlString = tree.read(cargoTomlPath, 'utf-8')!.toString();
    const cargoToml = this.parseCargoToml(cargoTomlString);
    const dependencyVersion = cargoToml.dependencies?.[dependencyProjectName];
    if (typeof dependencyVersion === 'string') {
      return {
        currentVersion: dependencyVersion,
        dependencyCollection: 'dependencies',
      };
    }
    return {
      currentVersion: dependencyVersion?.version || '0.0.0',
      dependencyCollection: 'dependencies',
    };
  }

  isLocalDependencyProtocol(_versionSpecifier: string): boolean {
    return false;
  }

  async updateDependencies(
    tree: Tree,
    _projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ) {
    for (const manifestPath of this.manifestsToUpdate) {
      const cargoTomlString = tree.read(manifestPath, 'utf-8')!.toString();
      const cargoToml = this.parseCargoToml(cargoTomlString);

      for (const [dep, version] of Object.entries(dependenciesToUpdate)) {
        ExampleRustManifestActions.modifyCargoTable(
          cargoToml,
          'dependencies',
          dep,
          version
        );
      }

      const updatedCargoTomlString =
        ExampleRustManifestActions.stringifyCargoToml(cargoToml);
      tree.write(manifestPath, updatedCargoTomlString);
    }
  }
}

export function parseGraphDefinition(definition: string) {
  const graph = { projects: {} as any };
  const lines = definition.trim().split('\n');
  let currentGroup = '';
  let groupConfig = {};
  let groupRelationship = '';

  let lastProjectName = '';

  lines.forEach((line) => {
    line = line.trim();
    if (!line) {
      // Skip empty lines
      return;
    }

    // Match group definitions with JSON config
    const groupMatch = line.match(/^(\w+)\s*\(\s*(\{.*?\})\s*\):$/);
    if (groupMatch) {
      currentGroup = groupMatch[1];
      groupConfig = JSON.parse(groupMatch[2]);
      groupRelationship = groupConfig['projectsRelationship'] || 'independent';
      return;
    }

    // Match project definitions with optional per-project JSON config
    const projectMatch = line.match(
      /^- ([\w-]+)@([\d\.]+) \[(\w+)(?::([^[\]]+))?\](?:\s*\(\s*(\{.*?\})\s*\))?$/
    );
    if (projectMatch) {
      const [_, name, version, language, alternateNameInManifest, configJson] =
        projectMatch;

      // Automatically add data for Rust projects
      let projectData = {};
      if (language === 'rust') {
        projectData = {
          release: { manifestActions: '__EXAMPLE_RUST_MANIFEST_ACTIONS__' },
        };
      }

      // Merge explicit per-project config if present
      if (configJson) {
        const explicitConfig = JSON.parse(configJson);
        projectData = { ...projectData, ...explicitConfig };
      }

      graph.projects[name] = {
        version,
        language,
        group: currentGroup,
        relationship: groupRelationship,
        dependsOn: [],
        data: projectData,
        // E.g. package name in package.json doesn't necessarily match the name of the nx project
        alternateNameInManifest,
      };
      lastProjectName = name;
      return;
    }

    // Match dependencies
    const dependsMatch = line.match(
      /^-> depends on ([~^=]?)([\w-]+)(?:\((.*?)\))?(?:\s*\{(\w+)\})?$/
    );
    if (dependsMatch) {
      const [
        _,
        prefix,
        depProject,
        versionSpecifier,
        depCollection = 'dependencies',
      ] = dependsMatch;
      // Add the dependency to the last added project
      if (!graph.projects[lastProjectName].dependsOn) {
        graph.projects[lastProjectName].dependsOn = [];
      }
      graph.projects[lastProjectName].dependsOn.push({
        project: depProject,
        collection: depCollection,
        prefix: prefix || '', // Store the prefix (empty string if not specified)
        versionSpecifier: versionSpecifier || undefined, // Store exact version specifier if provided
      });
      return;
    }

    // Ignore unrecognized lines
  });

  return graph;
}

function setupGraph(tree: any, graph: any) {
  const groups: NxReleaseConfig['groups'] = {};
  const projectGraph: ProjectGraph = { nodes: {}, dependencies: {} };

  for (const [projectName, projectData] of Object.entries(graph.projects)) {
    const {
      version,
      language,
      group,
      relationship,
      dependsOn,
      data,
      alternateNameInManifest,
    } = projectData as any;

    const packageName = alternateNameInManifest ?? projectName;

    // Write project files based on language
    if (language === 'js') {
      const packageJson: any = {
        name: packageName,
        version,
      };
      if (dependsOn) {
        dependsOn.forEach(
          (dep: {
            project: string;
            collection: string;
            prefix: string;
            versionSpecifier: string | undefined;
          }) => {
            if (!packageJson[dep.collection]) {
              packageJson[dep.collection] = {};
            }
            const depNode = graph.projects[dep.project];
            const depVersion = dep.versionSpecifier ?? depNode.version;
            packageJson[dep.collection][
              depNode.alternateNameInManifest ?? dep.project
            ] = `${dep.prefix}${depVersion}`;
          }
        );
      }
      writeJson(tree, `${projectName}/package.json`, packageJson);
    } else if (language === 'rust') {
      const cargoToml: CargoToml = {} as any;
      ExampleRustManifestActions.modifyCargoTable(
        cargoToml,
        'package',
        'name',
        projectName
      );
      ExampleRustManifestActions.modifyCargoTable(
        cargoToml,
        'package',
        'version',
        version
      );

      if (dependsOn) {
        dependsOn.forEach(
          (dep: {
            project: string;
            collection: string;
            prefix: string;
            versionSpecifier: string | undefined;
          }) => {
            ExampleRustManifestActions.modifyCargoTable(
              cargoToml,
              dep.collection,
              dep.project,
              {
                version:
                  dep.versionSpecifier ?? graph.projects[dep.project].version,
              }
            );
          }
        );
      }

      tree.write(
        `${projectName}/Cargo.toml`,
        ExampleRustManifestActions.stringifyCargoToml(cargoToml)
      );
    }

    // Add to projectGraph nodes
    const projectGraphProjectNode: ProjectGraphProjectNode = {
      name: projectName,
      type: 'lib',
      data: {
        root: projectName,
        ...data, // Merge any additional data from project config
      },
    };
    // Always add the js package metadata to match the @nx/js plugin
    projectGraphProjectNode.data.metadata = {
      js: {
        packageName,
      },
    };
    projectGraph.nodes[projectName] = projectGraphProjectNode;

    // Initialize dependencies
    projectGraph.dependencies[projectName] = [];

    // Handle dependencies
    if (dependsOn) {
      dependsOn.forEach((dep: { project: string; collection: string }) => {
        projectGraph.dependencies[projectName].push({
          source: projectName,
          target: dep.project,
          type: 'static',
        });
      });
    }

    // Add to releaseGroups
    if (!groups[group]) {
      groups[group] = {
        projectsRelationship: relationship,
        projects: [],
        // TODO: add missing properties here and remove as any
      } as any;
    }
    groups[group].projects.push(projectName);
  }

  return { groups, projectGraph };
}

export async function mockResolveManifestActionsForProjectImplementation(
  tree: Tree,
  releaseGroup: any,
  projectGraphNode: any,
  manifestRootsToUpdate: string[]
) {
  const exampleRustManifestActions = '__EXAMPLE_RUST_MANIFEST_ACTIONS__';
  if (
    projectGraphNode.data.release?.manifestActions ===
      exampleRustManifestActions ||
    releaseGroup.manifestActions === exampleRustManifestActions
  ) {
    const manifestActions = new ExampleRustManifestActions(
      releaseGroup,
      projectGraphNode,
      manifestRootsToUpdate
    );
    // Initialize the manifest actions with all the required manifest paths etc
    await manifestActions.init(tree);
    return {
      manifestActionsPath: exampleRustManifestActions,
      ManifestActionsClass: ExampleRustManifestActions,
      manifestActions: manifestActions,
    };
  }

  const manifestActionsPath =
    '@nx/js/src/generators/release-version/manifest-actions';
  // @ts-ignore
  const JsManifestActions = jest.requireActual(manifestActionsPath).default;
  const manifestActions: ManifestActions = new JsManifestActions(
    releaseGroup,
    projectGraphNode,
    manifestRootsToUpdate
  );
  // Initialize the manifest actions with all the required manifest paths etc
  await manifestActions.init(tree);
  return {
    manifestActionsPath,
    ManifestActionsClass: JsManifestActions,
    manifestActions: manifestActions,
  };
}
