import { globAsync, logger, Tree, workspaceRoot } from '@nx/devkit';
import {
  gradleProjectGraphPluginName,
  gradleProjectGraphVersion,
} from '../../utils/versions';
import { dirname, join } from 'path';
import { execGradleAsync, findGradlewFile } from '../../utils/exec-gradle';
import { getPluginAliasFromCatalogAst } from '../../utils/version-catalog-ast-utils';

/**
 * Adds a `build.gradle(.kts)` file next to each `settings.gradle(.kts)` file found in the workspace.
 * If the build.gradle file already exists, it reads its contents.
 */
export async function addBuildGradleFileNextToSettingsGradle(
  tree: Tree
): Promise<{ filePath: string; content: string }[]> {
  const settingsGradleFiles = await globAsync(tree, [
    '**/settings.gradle',
    '**/settings.gradle.kts',
  ]);

  return settingsGradleFiles.map((settingsGradlePath) => {
    return ensureBuildGradleFile(tree, settingsGradlePath);
  });
}

/**
 * Determines the appropriate build.gradle file path based on the settings file
 * and ensures it exists in the tree. Returns the path and contents.
 */
function ensureBuildGradleFile(
  tree: Tree,
  settingsGradlePath: string
): { filePath: string; content: string } {
  const isKotlinDsl = settingsGradlePath.endsWith('.kts');
  const buildGradleFile = join(
    dirname(settingsGradlePath),
    isKotlinDsl ? 'build.gradle.kts' : 'build.gradle'
  );

  let content = '';
  if (tree.exists(buildGradleFile)) {
    content = tree.read(buildGradleFile, 'utf-8');
  } else {
    tree.write(buildGradleFile, content);
  }

  return { filePath: buildGradleFile, content };
}

// a regex to get the version in build file in format `id "dev.nx.gradle.project-graph" version "x"`
const regex =
  /(id\s*\(?["']dev\.nx\.gradle\.project-graph["']\)?\s*version\s*\(?["'])([^"']+)(["']\)?)/;

/**
 * Extract gradle plugin version from build.gradle file
 */
export async function extractNxPluginVersion(
  gradleFilePath: string,
  gradleContent: string
): Promise<string | null> {
  const match = gradleContent.match(regex);
  let version = match ? match[2] : null;
  if (!version) {
    try {
      const gradlewFile = findGradlewFile(
        gradleFilePath,
        workspaceRoot,
        undefined
      );
      const buildEnvironment = (
        await execGradleAsync(join(workspaceRoot, gradlewFile), [
          'buildEnvironment',
          '--quiet',
        ])
      ).toString();
      version = getPluginVersion(buildEnvironment);
    } catch (e) {} // Silently ignore error, fallback remains null
  }
  return version;
}

function getPluginVersion(dependencyTree: string): string | null {
  const lines = dependencyTree.split('\n');

  for (const line of lines) {
    // line is dev.nx.gradle.project-graph:dev.nx.gradle.project-graph.gradle.plugin:version
    const match = line.match(
      /dev\.nx\.gradle\.project-graph:dev\.nx\.gradle\.project-graph\.gradle\.plugin:([^\s\\]+)/
    );
    if (match) {
      return match[1]; // returns the version part
    }
  }

  return null; // not found
}

/**
 * Updates the plugin version in the given Gradle file content.
 */
export function updateNxPluginVersion(
  content: string,
  newVersion: string
): string {
  if (regex.test(content)) {
    return content.replace(regex, `$1${newVersion}$3`);
  } else {
    logger.warn(
      `Please update plugin dev.nx.gradle.project-graph to ${newVersion}`
    );
  }
  return content;
}

/**
 * Ensures all build.gradle(.kts) files use the expected version of dev.nx.gradle.project-graph.
 */
export async function addNxProjectGraphPlugin(
  tree: Tree,
  expectedVersion: string = gradleProjectGraphVersion
) {
  const files = await addBuildGradleFileNextToSettingsGradle(tree);

  for (const { filePath, content } of files) {
    await addNxProjectGraphPluginToBuildGradle(
      filePath,
      content,
      expectedVersion,
      tree
    );
  }
}

/**
 * Converts a version catalog alias to a Gradle accessor path.
 * In Gradle, dashes in aliases become dots in the accessor.
 * e.g., "nx-project-graph" -> "nx.project.graph"
 */
function aliasToAccessorPath(alias: string): string {
  return alias.replace(/-/g, '.');
}

/**
 * Finds a version catalog file near the given build.gradle file and returns
 * the plugin alias if the Nx project graph plugin is defined in it.
 */
async function findVersionCatalogPluginAlias(
  gradleFilePath: string,
  tree: Tree
): Promise<string | null> {
  const gradleDir = dirname(gradleFilePath);
  const versionCatalogFiles = await globAsync(tree, [
    join(gradleDir, '**/libs.versions.toml'),
  ]);

  if (versionCatalogFiles.length === 0) {
    return null;
  }

  const versionCatalogPath = versionCatalogFiles[0];
  const catalogContent = tree.read(versionCatalogPath, 'utf-8');
  if (!catalogContent) {
    return null;
  }

  return getPluginAliasFromCatalogAst(
    catalogContent,
    gradleProjectGraphPluginName
  );
}

/**
 * Adds or updates the Nx Project Graph plugin in the build.gradle(.kts) file.
 * Ensures the correct version and applies the plugin to all projects.
 * Returns the updated build.gradle content.
 */
async function addNxProjectGraphPluginToBuildGradle(
  gradleFilePath: string,
  buildGradleContent: string,
  expectedVersion: string = gradleProjectGraphVersion,
  tree: Tree
): Promise<string> {
  const isKotlinDsl = gradleFilePath.endsWith('.kts');

  // Check if a version catalog exists with the plugin alias
  const pluginAlias = await findVersionCatalogPluginAlias(gradleFilePath, tree);
  const versionCatalogPluginAccessor = pluginAlias
    ? `libs.plugins.${aliasToAccessorPath(pluginAlias)}`
    : null;

  // Determine the plugin declaration syntax based on whether we have a version catalog
  const nxProjectGraphReportPlugin = versionCatalogPluginAccessor
    ? `alias(${versionCatalogPluginAccessor})`
    : isKotlinDsl
    ? `id("${gradleProjectGraphPluginName}") version("${expectedVersion}")`
    : `id "${gradleProjectGraphPluginName}" version "${expectedVersion}"`;

  // Check if the plugin is already included (directly or via version catalog alias)
  const hasPluginDirectly = buildGradleContent.includes(
    gradleProjectGraphPluginName
  );
  const hasPluginViaAlias =
    versionCatalogPluginAccessor &&
    buildGradleContent.includes(versionCatalogPluginAccessor);
  const hasPlugin = hasPluginDirectly || hasPluginViaAlias;

  // Helper to add plugin to plugins block
  function addPluginToPluginsBlock(content: string): string {
    return content.replace(
      /plugins\s*\{/,
      `plugins {\n    ${nxProjectGraphReportPlugin}`
    );
  }

  // Helper to add plugins block if missing
  function addPluginsBlock(content: string): string {
    return `plugins {\n    ${nxProjectGraphReportPlugin}\n}\n${content}`;
  }

  // Helper to add plugin application to allprojects
  function addPluginToAllProjects(content: string): string {
    const applyPlugin = versionCatalogPluginAccessor
      ? `plugin(${versionCatalogPluginAccessor})`
      : isKotlinDsl
      ? `plugin("${gradleProjectGraphPluginName}")`
      : `plugin("${gradleProjectGraphPluginName}")`;
    return `${content}\nallprojects {\n    apply {\n        ${applyPlugin}\n    }\n}`;
  }

  // Add to plugins block if plugin not already present
  if (buildGradleContent.includes('plugins {')) {
    if (hasPlugin) {
      // Plugin already exists - update version if needed (only for direct declarations)
      if (hasPluginDirectly) {
        const currentVersion = await extractNxPluginVersion(
          gradleFilePath,
          buildGradleContent
        );
        if (currentVersion && currentVersion !== expectedVersion) {
          buildGradleContent = updateNxPluginVersion(
            buildGradleContent,
            expectedVersion
          );
        }
      }
    } else {
      buildGradleContent = addPluginToPluginsBlock(buildGradleContent);
    }
  } else {
    buildGradleContent = addPluginsBlock(buildGradleContent);
  }

  // Check if plugin is already applied in allprojects (either via direct name or version catalog)
  const applyPluginPattern = versionCatalogPluginAccessor
    ? new RegExp(
        `\\s*plugin\\(${versionCatalogPluginAccessor.replace(/\./g, '\\.')}\\)`
      )
    : new RegExp(`\\s*plugin\\(["']${gradleProjectGraphPluginName}["']\\)`);

  if (buildGradleContent.includes('allprojects {')) {
    if (!applyPluginPattern.test(buildGradleContent)) {
      const applyPlugin = versionCatalogPluginAccessor
        ? `plugin(${versionCatalogPluginAccessor})`
        : isKotlinDsl
        ? `plugin("${gradleProjectGraphPluginName}")`
        : `plugin "${gradleProjectGraphPluginName}"`;

      buildGradleContent = buildGradleContent.replace(
        /allprojects\s*\{/,
        `allprojects {\n    apply ${applyPlugin}`
      );
    }
  } else {
    buildGradleContent = addPluginToAllProjects(buildGradleContent);
  }

  tree.write(gradleFilePath, buildGradleContent);
  return buildGradleContent;
}
