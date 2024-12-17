import TOML from '@ltd/j-toml';
import { join } from 'node:path';
import type { NxJsonConfiguration } from '../../../config/nx-json';
import type { ProjectGraph } from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import { writeJson } from '../../../generators/utils/json';
import { createProjectFileMapUsingProjectGraph } from '../../../project-graph/file-map-utils';
import { createNxReleaseConfig, NxReleaseConfig } from '../config/config';
import { filterReleaseGroups } from '../config/filter-release-groups';
import { ManifestActions, ManifestData } from './flexible-version-management';

export async function createNxReleaseConfigAndPopulateWorkspace(
  tree: Tree,
  graphDefinition: string,
  additionalNxReleaseConfig: Exclude<NxJsonConfiguration['release'], 'groups'>,
  mockResolveCurrentVersion?: any
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
    // TODO: Leverage this?
    // releaseGroupToFilteredProjects,
  } = filterReleaseGroups(projectGraph, nxReleaseConfig!);
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
    nxReleaseConfig: nxReleaseConfig!,
    releaseGroups,
    projectGraph,
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
  getPrimaryManifestPath(): string {
    return join(this.projectGraphNode.data.root, 'Cargo.toml');
  }

  async ensureManifestExistsAtExpectedLocation(tree: Tree) {}

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

  async readManifestData(tree: Tree): Promise<ManifestData> {
    const cargoTomlPath = join(this.projectGraphNode.data.root, 'Cargo.toml');
    const cargoTomlString = tree.read(cargoTomlPath, 'utf-8')!.toString();
    const cargoToml = this.parseCargoToml(cargoTomlString);

    const currentVersion = cargoToml.package?.version || '0.0.0';
    const name = cargoToml.package?.name || 'unknown';

    const dependencies: Record<string, Record<string, string>> = {
      dependencies: {},
    };

    if (cargoToml.dependencies) {
      for (const [dep, version] of Object.entries(cargoToml.dependencies)) {
        dependencies.dependencies[dep] =
          typeof version === 'string' ? version : version.version;
      }
    }

    return {
      name,
      currentVersion,
      dependencies,
    };
  }

  async resolveCurrentVersion(tree: Tree): Promise<string> {
    return (await this.readManifestData(tree)).currentVersion;
  }

  async writeVersionToManifest(tree: Tree, newVersion: string) {
    const cargoTomlPath = join(this.projectGraphNode.data.root, 'Cargo.toml');
    const cargoTomlString = tree.read(cargoTomlPath, 'utf-8')!.toString();
    const cargoToml = this.parseCargoToml(cargoTomlString);
    ExampleRustManifestActions.modifyCargoTable(
      cargoToml,
      'package',
      'version',
      newVersion
    );
    const updatedCargoTomlString =
      ExampleRustManifestActions.stringifyCargoToml(cargoToml);
    tree.write(cargoTomlPath, updatedCargoTomlString);
  }

  async updateDependencies(
    tree: Tree,
    dependenciesToUpdate: Record<string, string>
  ) {
    const cargoTomlPath = join(this.projectGraphNode.data.root, 'Cargo.toml');
    const cargoTomlString = tree.read(cargoTomlPath, 'utf-8')!.toString();
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
    tree.write(cargoTomlPath, updatedCargoTomlString);
  }
}

function parseGraphDefinition(definition: string) {
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
      /^- ([\w-]+)@([\d\.]+) \[(\w+)\](?:\s*\(\s*(\{.*?\})\s*\))?$/
    );
    if (projectMatch) {
      const [_, name, version, language, configJson] = projectMatch;

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
      };
      lastProjectName = name;
      return;
    }

    // Match dependencies
    const dependsMatch = line.match(
      /^-> depends on ([~^=]?)([\w-]+)(?:\s*\{(\w+)\})?$/
    );
    if (dependsMatch) {
      const [_, prefix, depProject, depCollection = 'dependencies'] =
        dependsMatch;
      // Add the dependency to the last added project
      if (!graph.projects[lastProjectName].dependsOn) {
        graph.projects[lastProjectName].dependsOn = [];
      }
      graph.projects[lastProjectName].dependsOn.push({
        project: depProject,
        collection: depCollection,
        prefix: prefix || '', // Store the prefix (empty string if not specified)
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
    const { version, language, group, relationship, dependsOn, data } =
      projectData as any;

    // Write project files based on language
    if (language === 'js') {
      const packageJson: any = { name: projectName, version };
      if (dependsOn) {
        dependsOn.forEach(
          (dep: { project: string; collection: string; prefix: string }) => {
            if (!packageJson[dep.collection]) {
              packageJson[dep.collection] = {};
            }
            const depVersion = graph.projects[dep.project].version;
            packageJson[dep.collection][
              dep.project
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
          (dep: { project: string; collection: string; prefix: string }) => {
            ExampleRustManifestActions.modifyCargoTable(
              cargoToml,
              dep.collection,
              dep.project,
              {
                version: graph.projects[dep.project].version,
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
    projectGraph.nodes[projectName] = {
      name: projectName,
      type: 'lib',
      data: {
        root: projectName,
        ...data, // Merge any additional data from project config
      },
    };

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
  projectGraphNode: any
) {
  const exampleRustManifestActions = '__EXAMPLE_RUST_MANIFEST_ACTIONS__';
  if (
    projectGraphNode.data.release?.manifestActions ===
      exampleRustManifestActions ||
    releaseGroup.manifestActions === exampleRustManifestActions
  ) {
    const manifestActions = new ExampleRustManifestActions(projectGraphNode);
    await manifestActions.ensureManifestExistsAtExpectedLocation(tree);
    return manifestActions;
  }
  // @ts-ignore
  const JsManifestActions = jest.requireActual(
    // nx-ignore-next-line
    '@nx/js/src/generators/release-version/manifest-actions'
  ).default;
  const manifestActions = new JsManifestActions(projectGraphNode);
  await manifestActions.ensureManifestExistsAtExpectedLocation(tree);
  return manifestActions;
}
