import TOML from 'smol-toml';
import { join } from 'node:path';
import type {
  NxJsonConfiguration,
  NxReleaseVersionConfiguration,
} from '../../../config/nx-json';
import type {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../../config/project-graph';
import type { Tree } from '../../../generators/tree';
import { writeJson } from '../../../generators/utils/json';
import { createProjectFileMapUsingProjectGraph } from '../../../project-graph/file-map-utils';
import {
  createNxReleaseConfig,
  DEFAULT_VERSION_ACTIONS_PATH,
  NxReleaseConfig,
} from '../config/config';
import {
  createReleaseGraph,
  type FinalConfigForProject,
} from '../utils/release-graph';
import { ReleaseGroupProcessor } from './release-group-processor';
import { VersionActions } from './version-actions';

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

  // Mock the implementation of resolveCurrentVersion to reliably return the version of the project based on our graph definition
  mockResolveCurrentVersion?.mockImplementation((_, { name }) => {
    for (const [projectName, project] of Object.entries(graph.projects)) {
      if (projectName === name) {
        return (project as any).version ?? null;
      }
    }
    throw new Error(`Unknown project name in test utils: ${name}`);
  });

  return {
    projectGraph,
    nxReleaseConfig: nxReleaseConfig!,
    filters,
  };
}

export async function createTestReleaseGroupProcessor(
  tree: Tree,
  projectGraph: ProjectGraph,
  nxReleaseConfig: NxReleaseConfig,
  filters: {
    projects?: string[];
    groups?: string[];
  },
  options: {
    dryRun?: boolean;
    verbose?: boolean;
    firstRelease?: boolean;
    preid?: string;
    userGivenSpecifier?: string;
  } = {}
) {
  const releaseGraph = await createReleaseGraph({
    tree,
    projectGraph,
    nxReleaseConfig,
    filters,
    firstRelease: options.firstRelease ?? false,
    preid: options.preid,
    verbose: options.verbose ?? false,
  });

  return new ReleaseGroupProcessor(
    tree,
    projectGraph,
    nxReleaseConfig,
    releaseGraph,
    {
      dryRun: options.dryRun ?? false,
      verbose: options.verbose ?? false,
      firstRelease: options.firstRelease ?? false,
      preid: options.preid ?? '',
      userGivenSpecifier: options.userGivenSpecifier,
      filters,
    }
  );
}

/**
 * A non-production grade rust implementation to prove out loading multiple different versionActions in various setups
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

export class ExampleRustVersionActions extends VersionActions {
  validManifestFilenames = ['Cargo.toml'];

  private parseCargoToml(cargoString: string): CargoToml {
    return TOML.parse(cargoString) as CargoToml;
  }

  static stringifyCargoToml(cargoToml: CargoToml): string {
    return TOML.stringify(cargoToml);
  }

  static modifyCargoTable(
    toml: CargoToml,
    section: string,
    key: string,
    value: string | object | Array<any> | (() => any)
  ) {
    toml[section] ??= {};
    toml[section][key] = typeof value === 'function' ? value() : value;
  }

  async readCurrentVersionFromSourceManifest(tree: Tree): Promise<{
    currentVersion: string;
    manifestPath: string;
  }> {
    const cargoTomlPath = join(this.projectGraphNode.data.root, 'Cargo.toml');
    const cargoTomlString = tree.read(cargoTomlPath, 'utf-8')!.toString();
    const cargoToml = this.parseCargoToml(cargoTomlString);
    const currentVersion = cargoToml.package?.version || '0.0.0';
    return {
      currentVersion,
      manifestPath: cargoTomlPath,
    };
  }

  async readCurrentVersionFromRegistry(
    tree: Tree,
    _currentVersionResolverMetadata: NxReleaseVersionConfiguration['currentVersionResolverMetadata']
  ): Promise<{
    currentVersion: string;
    logText: string;
  }> {
    // Real registry resolver not needed for this test example
    return {
      currentVersion: (await this.readCurrentVersionFromSourceManifest(tree))
        .currentVersion,
      logText: 'https://example.com/fake-registry',
    };
  }

  async updateProjectVersion(tree: Tree, newVersion: string) {
    const logMessages: string[] = [];
    for (const manifestToUpdate of this.manifestsToUpdate) {
      const cargoTomlString = tree
        .read(manifestToUpdate.manifestPath, 'utf-8')!
        .toString();
      const cargoToml = this.parseCargoToml(cargoTomlString);
      ExampleRustVersionActions.modifyCargoTable(
        cargoToml,
        'package',
        'version',
        newVersion
      );
      const updatedCargoTomlString =
        ExampleRustVersionActions.stringifyCargoToml(cargoToml);
      tree.write(manifestToUpdate.manifestPath, updatedCargoTomlString);
      logMessages.push(
        `✍️  New version ${newVersion} written to manifest: ${manifestToUpdate.manifestPath}`
      );
    }
    return logMessages;
  }

  async readCurrentVersionOfDependency(
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

  // NOTE: Does not take the preserveLocalDependencyProtocols setting into account yet
  async updateProjectDependencies(
    tree: Tree,
    _projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<string[]> {
    const numDependenciesToUpdate = Object.keys(dependenciesToUpdate).length;
    const depText =
      numDependenciesToUpdate === 1 ? 'dependency' : 'dependencies';
    if (numDependenciesToUpdate === 0) {
      return [];
    }

    const logMessages: string[] = [];
    for (const manifestToUpdate of this.manifestsToUpdate) {
      const cargoTomlString = tree
        .read(manifestToUpdate.manifestPath, 'utf-8')!
        .toString();
      const cargoToml = this.parseCargoToml(cargoTomlString);

      for (const [dep, version] of Object.entries(dependenciesToUpdate)) {
        ExampleRustVersionActions.modifyCargoTable(
          cargoToml,
          'dependencies',
          dep,
          version
        );
      }

      const updatedCargoTomlString =
        ExampleRustVersionActions.stringifyCargoToml(cargoToml);
      tree.write(manifestToUpdate.manifestPath, updatedCargoTomlString);

      logMessages.push(
        `✍️  Updated ${numDependenciesToUpdate} ${depText} in manifest: ${manifestToUpdate.manifestPath}`
      );
    }
    return logMessages;
  }
}

const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/**
 * Test-only stand-in for `JsVersionActions` from `@nx/js`. Implements
 * just enough of the contract to drive the release-orchestration tests
 * against synthetic `package.json` files in the tree, without importing
 * `@nx/devkit` or `@nx/js` source. JS-specific behavior (registry
 * resolution, catalog support, lockfile updates) is exercised by
 * `packages/js`'s own tests against the real `JsVersionActions`.
 */
export class MockJsVersionActions extends VersionActions {
  validManifestFilenames = ['package.json'];

  private read = (tree: Tree, manifestPath: string): any =>
    JSON.parse(tree.read(manifestPath, 'utf-8')!.toString());

  // Match `@nx/devkit`'s `updateJson` formatting (2-space indent + trailing
  // newline) so existing snapshots continue to match.
  private write = (tree: Tree, manifestPath: string, json: any): void =>
    tree.write(manifestPath, JSON.stringify(json, null, 2) + '\n');

  private sourceManifestPath = (): string =>
    join(this.projectGraphNode.data.root, 'package.json');

  async readCurrentVersionFromSourceManifest(tree: Tree) {
    const manifestPath = this.sourceManifestPath();
    return {
      manifestPath,
      currentVersion: this.read(tree, manifestPath).version,
    };
  }

  async readCurrentVersionFromRegistry() {
    return { currentVersion: null, logText: 'mock-registry' };
  }

  async readCurrentVersionOfDependency(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependencyProjectName: string
  ) {
    const json = this.read(tree, this.sourceManifestPath());
    const name =
      projectGraph.nodes[dependencyProjectName].data.metadata?.js?.packageName;
    for (const depType of DEPENDENCY_FIELDS) {
      if (name && json[depType]?.[name]) {
        return {
          currentVersion: json[depType][name],
          dependencyCollection: depType,
        };
      }
    }
    return { currentVersion: null, dependencyCollection: null };
  }

  async updateProjectVersion(
    tree: Tree,
    newVersion: string
  ): Promise<string[]> {
    return this.manifestsToUpdate.map(({ manifestPath }) => {
      const json = this.read(tree, manifestPath);
      json.version = newVersion;
      this.write(tree, manifestPath, json);
      return `✍️  New version ${newVersion} written to manifest: ${manifestPath}`;
    });
  }

  async updateProjectDependencies(
    tree: Tree,
    projectGraph: ProjectGraph,
    dependenciesToUpdate: Record<string, string>
  ): Promise<string[]> {
    let count = Object.keys(dependenciesToUpdate).length;
    if (count === 0) return [];

    const logs: string[] = [];
    for (const { manifestPath, preserveLocalDependencyProtocols } of this
      .manifestsToUpdate) {
      const json = this.read(tree, manifestPath);
      for (const depType of DEPENDENCY_FIELDS) {
        if (!json[depType]) continue;
        for (const [dep, newVersion] of Object.entries(dependenciesToUpdate)) {
          const name = projectGraph.nodes[dep].data.metadata?.js?.packageName;
          const current = name && json[depType][name];
          if (!current) continue;
          if (
            preserveLocalDependencyProtocols &&
            (current.startsWith('file:') || current.startsWith('workspace:'))
          ) {
            count--;
            continue;
          }
          json[depType][name] = newVersion;
        }
      }
      this.write(tree, manifestPath, json);
      if (count > 0) {
        const word = count === 1 ? 'dependency' : 'dependencies';
        logs.push(`✍️  Updated ${count} ${word} in manifest: ${manifestPath}`);
      }
    }
    return logs;
  }
}

export class ExampleNonSemverVersionActions extends VersionActions {
  validManifestFilenames = null;

  async readCurrentVersionFromSourceManifest() {
    return null;
  }

  async readCurrentVersionFromRegistry() {
    return null;
  }

  async readCurrentVersionOfDependency() {
    return {
      currentVersion: null,
      dependencyCollection: null,
    };
  }

  async updateProjectVersion(tree, newVersion) {
    tree.write(
      join(this.projectGraphNode.data.root, 'version.txt'),
      newVersion
    );
    return [];
  }

  async updateProjectDependencies() {
    return [];
  }

  // Overwrite the default calculateNewVersion method to return the new version directly and not consider semver
  async calculateNewVersion(
    currentVersion: string | null,
    newVersionInput: string,
    newVersionInputReason: string,
    newVersionInputReasonData: Record<string, unknown>,
    preid: string
  ): Promise<{ newVersion: string; logText: string }> {
    if (newVersionInput === 'patch') {
      return {
        newVersion:
          '{SOME_NEW_VERSION_DERIVED_AS_A_SIDE_EFFECT_OF_DEPENDENCY_BUMP}',
        logText: `Determined new version as a side effect of dependency bump: ${newVersionInput}`,
      };
    }

    return {
      newVersion: newVersionInput,
      logText: `Applied new version directly: ${newVersionInput}`,
    };
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
      /^- ([\w-]+)(?:\[([\w\/-]+)\])?(?:@([\w\.-]+))? \[([\w-]+)(?::([^[\]]+))?\](?:\s*\(\s*(\{.*?\})\s*\))?$/
    );
    if (projectMatch) {
      const [
        _,
        name,
        customProjectRoot,
        version,
        language,
        alternateNameInManifest,
        configJson,
      ] = projectMatch;

      // Automatically add data for Rust projects
      let projectData = {} as any;
      if (customProjectRoot) {
        projectData.root = customProjectRoot;
      }
      if (language === 'rust') {
        projectData = {
          release: { versionActions: exampleRustVersionActions },
        };
      } else if (language === 'non-semver') {
        projectData = {
          release: { versionActions: exampleNonSemverVersionActions },
        };
      }

      // Merge explicit per-project config if present
      if (configJson) {
        const explicitConfig = JSON.parse(configJson);
        projectData = { ...projectData, ...explicitConfig };
      }

      graph.projects[name] = {
        version: version ?? null,
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

    // Match release config overrides
    const releaseConfigMatch = line.match(
      /^-> release config overrides (\{.*\})$/
    );
    if (releaseConfigMatch) {
      const [_, releaseConfigJson] = releaseConfigMatch;
      const releaseConfigOverrides = JSON.parse(releaseConfigJson);
      if (!graph.projects[lastProjectName].releaseConfigOverrides) {
        graph.projects[lastProjectName].releaseConfigOverrides = {};
      }
      graph.projects[lastProjectName].releaseConfigOverrides = {
        ...graph.projects[lastProjectName].releaseConfigOverrides,
        ...releaseConfigOverrides,
      };
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
      releaseConfigOverrides,
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
      writeJson(
        tree,
        join(data.root ?? projectName, 'package.json'),
        packageJson
      );
      // Write extra manifest files if specified
      if (releaseConfigOverrides?.version?.manifestRootsToUpdate) {
        releaseConfigOverrides.version.manifestRootsToUpdate.forEach((root) => {
          writeJson(tree, join(root, 'package.json'), packageJson);
        });
      }
    } else if (language === 'rust') {
      const cargoToml: CargoToml = {} as any;
      ExampleRustVersionActions.modifyCargoTable(
        cargoToml,
        'package',
        'name',
        projectName
      );
      ExampleRustVersionActions.modifyCargoTable(
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
            ExampleRustVersionActions.modifyCargoTable(
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

      const contents = ExampleRustVersionActions.stringifyCargoToml(cargoToml);
      tree.write(join(data.root ?? projectName, 'Cargo.toml'), contents);
      // Write extra manifest files if specified
      if (releaseConfigOverrides?.version?.manifestRootsToUpdate) {
        releaseConfigOverrides.version.manifestRootsToUpdate.forEach((root) => {
          tree.write(join(root, 'Cargo.toml'), contents);
        });
      }
    } else if (language === 'non-semver') {
      tree.write(join(data.root ?? projectName, 'version.txt'), version ?? '');
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
    if (language === 'js') {
      // Always add the js package metadata to match the @nx/js plugin
      projectGraphProjectNode.data.metadata = {
        js: {
          packageName,
        },
      };
    }

    // Add project level release config overrides
    if (releaseConfigOverrides) {
      projectGraphProjectNode.data.release = {
        ...projectGraphProjectNode.data.release,
        ...releaseConfigOverrides,
      };
    }

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
      } as any;
    }
    groups[group].projects.push(projectName);
  }

  return { groups, projectGraph };
}

const exampleRustVersionActions = '__EXAMPLE_RUST_VERSION_ACTIONS__';
const exampleNonSemverVersionActions = '__EXAMPLE_NON_SEMVER_VERSION_ACTIONS__';

export async function mockResolveVersionActionsForProjectImplementation(
  tree: Tree,
  releaseGroup: any,
  projectGraphNode: any,
  finalConfigForProject: FinalConfigForProject
) {
  if (
    projectGraphNode.data.release?.versionActions ===
      exampleRustVersionActions ||
    releaseGroup.versionActions === exampleRustVersionActions
  ) {
    const versionActions = new ExampleRustVersionActions(
      releaseGroup,
      projectGraphNode,
      finalConfigForProject
    );
    // Initialize the versionActions with all the required manifest paths etc
    await versionActions.init(tree);
    return {
      versionActionsPath: exampleRustVersionActions,
      versionActions,
    };
  }

  if (
    projectGraphNode.data.release?.versionActions ===
      exampleNonSemverVersionActions ||
    releaseGroup.versionActions === exampleNonSemverVersionActions
  ) {
    const versionActions = new ExampleNonSemverVersionActions(
      releaseGroup,
      projectGraphNode,
      finalConfigForProject
    );
    // Initialize the versionActions with all the required manifest paths etc
    await versionActions.init(tree);
    return {
      versionActionsPath: exampleNonSemverVersionActions,
      versionActions,
    };
  }

  // Default path: use a self-contained MockJsVersionActions instead of
  // `jest.requireActual('@nx/js/src/release/version-actions')`. The real
  // module imports from `@nx/devkit`, which would pull devkit's entire
  // source tree into the test sandbox. Tests that genuinely depend on
  // JsVersionActions behavior (registry resolution, lockfile updates,
  // catalog support, etc.) live in `packages/js/src/release` and import
  // the real module directly.
  const versionActionsPath = DEFAULT_VERSION_ACTIONS_PATH;
  const versionActions: VersionActions = new MockJsVersionActions(
    releaseGroup,
    projectGraphNode,
    finalConfigForProject
  );
  await versionActions.init(tree);
  return {
    versionActionsPath,
    versionActions,
    afterAllProjectsVersioned: undefined,
  };
}
