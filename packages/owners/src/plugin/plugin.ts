import {
  CreateMetadata,
  FileData,
  joinPathFragments,
  ProjectGraph,
  ProjectGraphProjectNode,
  ProjectsMetadata,
} from '@nx/devkit';
import { findNodeAtLocation, Node, parseTree } from 'jsonc-parser';
import { minimatch } from 'minimatch';
import { existsSync, readFileSync } from 'node:fs';
import {
  createFileMapUsingProjectGraph,
  findMatchingProjects,
  type ProjectMetadata,
} from '@nx/devkit/internal';
import {
  ProjectOwnersConfig,
  RootOwnersConfig,
  validateAndSetDefaultsForRootConfig,
} from '../config';

export const createMetadata: CreateMetadata = async (
  graph,
  _options,
  context
) => {
  const nxJson = context.nxJsonConfiguration;
  let rootOwners = nxJson.owners;
  // Owners is not enabled at all in nx.json, do nothing
  if (!rootOwners) {
    return {};
  }

  let hasRootConfig = true;
  // `true` shorthand to enable the feature but delegate to project.json
  if (typeof rootOwners === 'boolean') {
    // No root config in use, we can skip parsing the nx.json file etc
    hasRootConfig = false;
    rootOwners = {};
  }

  // Ensure the config is valid before proceeding
  if (!validateAndSetDefaultsForRootConfig(rootOwners)) {
    return {};
  }

  // Even though the context already provides the resolved nx.json configuration, we still need the raw contents as a string to trace LOC information.
  const nxJsonContents = readFileSync(
    joinPathFragments(context.workspaceRoot, 'nx.json'),
    'utf-8'
  );
  const metadata: ProjectsMetadata = {};
  const { fileMap } = await createFileMapUsingProjectGraph(graph);
  const allWorkspaceFiles: FileData[] = [
    ...Object.values(fileMap.projectFileMap).flat(),
    ...fileMap.nonProjectFiles,
  ];

  // nx.json level config
  if (hasRootConfig) {
    const fileToProjectMap: Record<string, string> = {};
    // Preprocess to invert the mapping to be file -> project name (only do this if "files" is used at least once)
    if (rootOwners.patterns.some((pattern) => 'files' in pattern)) {
      for (const [projectName, fileData] of Object.entries(
        fileMap.projectFileMap
      )) {
        for (const file of fileData) {
          fileToProjectMap[file.file] = projectName;
        }
      }
    }
    applyRootConfigToProjectMetadata(
      graph,
      rootOwners,
      metadata,
      nxJsonContents,
      allWorkspaceFiles,
      fileToProjectMap,
      fileMap
    );
  }

  // project level config
  for (const [projectName, projectNode] of Object.entries(graph.nodes)) {
    applyProjectLevelConfigToProjectMetadata(
      projectName,
      projectNode,
      (fileMap.projectFileMap[projectName] || []).map((file) => file.file),
      metadata,
      context.workspaceRoot
    );
  }

  return metadata;
};

/**
 * Ownership in nx.json can be expressed in terms of projects or files.
 * For projects we can apply the owners directly, for files we need
 * to derive the projects from the file to project map.
 */
function applyRootConfigToProjectMetadata(
  projectGraph: ProjectGraph,
  rootOwners: RootOwnersConfig,
  metadata: ProjectsMetadata,
  nxJsonContents: string,
  allWorkspaceFiles: FileData[],
  fileToProjectMap: Record<string, string>,
  fileMap: { projectFileMap: Record<string, FileData[]> }
) {
  const nxJsonNode = getJsonNode(nxJsonContents);

  for (let i = 0; i < rootOwners.patterns.length; i++) {
    const pattern = rootOwners.patterns[i];

    /**
     * We start with file ownership, because it's the most granular and then project level
     * ownership can naturally override it.
     */
    if ('files' in pattern && !('projects' in pattern)) {
      // Use the file patterns to resolve a list of actual files from the workspace
      const matchingFiles = allWorkspaceFiles.filter(({ file }) => {
        for (const filePattern of pattern.files) {
          if (matchesCodeownersStylePattern(file, filePattern)) {
            return true;
          }
        }
        return false;
      });

      // Figure out the relevant projects from the matching files for the current pattern
      const projectsToProjectFiles = new Map<string, string[]>();
      for (const file of matchingFiles) {
        const projectName = fileToProjectMap[file.file];
        if (!projectName) {
          continue;
        }
        if (!projectsToProjectFiles.has(fileToProjectMap[file.file])) {
          projectsToProjectFiles.set(projectName, []);
        }
        projectsToProjectFiles.get(projectName)?.push(file.file);
      }

      // Ensure there is an entry for each owner in the metadata for each of the resolved projects
      for (const [
        projectName,
        projectFiles,
      ] of projectsToProjectFiles.entries()) {
        metadata[projectName] = metadata[projectName] || {};
        metadata[projectName].metadata = metadata[projectName].metadata || {};
        metadata[projectName].metadata.owners ||=
          metadata[projectName].metadata.owners || {};

        if (pattern.owners === false) {
          continue;
        }

        for (let j = 0; j < pattern.owners.length; j++) {
          const ownerId = pattern.owners[j];
          const fromConfig = resolveFromConfigDataForJsonAtFilePath(
            'nx.json',
            nxJsonNode,
            nxJsonContents,
            ['owners', 'patterns', i, 'owners', j]
          );

          if (!metadata[projectName].metadata.owners[ownerId]) {
            metadata[projectName].metadata.owners[ownerId] = {
              ownedFiles: [],
            };
          }
          metadata[projectName].metadata.owners[ownerId].ownedFiles.push({
            files: projectFiles,
            fromConfig,
          });
        }
      }
    }

    if ('projects' in pattern) {
      // Convert the pattern.projects entries into an array of project names
      const projectNames = findMatchingProjects(
        pattern.projects,
        projectGraph.nodes
      );

      // When both projects and files are present, scope file patterns to matched project roots
      const hasScopedFiles = 'files' in pattern;

      for (const projectName of projectNames) {
        metadata[projectName] = metadata[projectName] || {};
        metadata[projectName].metadata = metadata[projectName].metadata || {};
        metadata[projectName].metadata.owners ||=
          metadata[projectName].metadata.owners || {};

        if (pattern.owners === false) {
          continue;
        }

        if (hasScopedFiles) {
          // Resolve which project files match the file patterns
          const projectRoot = projectGraph.nodes[projectName]?.data?.root;
          const scopedPatterns = pattern.files.map((fp) =>
            joinPathFragments(projectRoot, fp)
          );
          const projectFileMap = fileMap.projectFileMap[projectName] || [];
          const matchingProjectFiles = projectFileMap
            .filter((f) => scopedPatterns.some((p) => minimatch(f.file, p)))
            .map((f) => f.file);

          for (let j = 0; j < pattern.owners.length; j++) {
            const ownerId = pattern.owners[j];
            const fromConfig = resolveFromConfigDataForJsonAtFilePath(
              'nx.json',
              nxJsonNode,
              nxJsonContents,
              ['owners', 'patterns', i, 'owners', j]
            );

            if (!metadata[projectName].metadata.owners[ownerId]) {
              metadata[projectName].metadata.owners[ownerId] = {
                ownedFiles: [],
              };
            }
            metadata[projectName].metadata.owners[ownerId].ownedFiles.push({
              files: matchingProjectFiles,
              fromConfig,
            });
          }
        } else {
          for (let j = 0; j < pattern.owners.length; j++) {
            const ownerId = pattern.owners[j];
            const fromConfig = resolveFromConfigDataForJsonAtFilePath(
              'nx.json',
              nxJsonNode,
              nxJsonContents,
              ['owners', 'patterns', i, 'owners', j]
            );

            // If there is already an entry for owner for this project, we can always overwrite because project level should take priority
            metadata[projectName].metadata.owners[ownerId] = {
              ownedFiles: [
                {
                  files: ['*'],
                  fromConfig,
                },
              ],
            };
          }
        }
      }
    }
  }
}

/**
 * Root-level `files` patterns are written verbatim into the generated CODEOWNERS file,
 * where the VCS provider applies gitignore-style matching. Ownership metadata must
 * mirror those semantics, otherwise e.g. a default `"*"` pattern owns every file in
 * the generated output but no project in the metadata (and rules like ensure-owners
 * report false violations):
 * - a leading `/` anchors the pattern to the workspace root (all file paths are workspace-relative)
 * - a pattern whose only `/` is a trailing one matches at any depth
 * - a trailing `/` matches a directory and everything in it
 * - a pattern naming a directory owns everything in it, but a trailing `*` only owns direct children
 * - dotfiles are included
 */
function matchesCodeownersStylePattern(file: string, pattern: string): boolean {
  const anchored = pattern.slice(0, -1).includes('/');
  let normalized = pattern.startsWith('/') ? pattern.slice(1) : pattern;
  if (normalized.endsWith('/')) {
    normalized += '**';
  }
  if (!anchored) {
    normalized = `**/${normalized}`;
  }
  if (minimatch(file, normalized, { dot: true })) {
    return true;
  }
  return (
    !normalized.endsWith('*') &&
    minimatch(file, `${normalized}/**`, { dot: true })
  );
}

function applyProjectLevelConfigToProjectMetadata(
  projectName: string,
  projectNode: ProjectGraphProjectNode,
  projectFiles: string[],
  metadata: ProjectsMetadata,
  workspaceRoot: string
) {
  const projectOwnersConfig = (
    projectNode.data as { owners?: ProjectOwnersConfig }
  ).owners;
  if (!projectOwnersConfig) {
    return;
  }
  metadata[projectName] = metadata[projectName] || {};
  metadata[projectName].metadata = metadata[projectName].metadata || {};
  metadata[projectName].metadata.owners ||=
    metadata[projectName].metadata.owners || {};

  // TODO: Technically this could come from package.json as well?
  let projectJsonNode: Node | null = null;
  let projectJsonContents = '';
  const workspaceRelativeProjectJsonPath = joinPathFragments(
    projectNode.data.root,
    'project.json'
  );
  const projectJsonPath = joinPathFragments(
    workspaceRoot,
    workspaceRelativeProjectJsonPath
  );
  if (existsSync(projectJsonPath)) {
    projectJsonContents = readFileSync(projectJsonPath, 'utf-8');
    projectJsonNode = getJsonNode(projectJsonContents);
  }

  // Each key is a file pattern to match against
  for (const [filePattern, owners] of Object.entries(projectOwnersConfig)) {
    const ownerIds = Array.isArray(owners) ? owners : owners.owners;
    for (const ownerId of ownerIds) {
      const jsonPath = ['owners', filePattern];
      if (!Array.isArray(owners)) {
        jsonPath.push('owners');
      }
      const fromConfig = resolveFromConfigDataForJsonAtFilePath(
        workspaceRelativeProjectJsonPath,
        projectJsonNode,
        projectJsonContents,
        jsonPath
      );

      metadata[projectName].metadata.owners[ownerId] = metadata[projectName]
        .metadata.owners[ownerId] || {
        ownedFiles: [],
      };
      // If the owner already exists for the current project with ownedFiles.files === ['*'], they already own the whole project, no action needed
      if (
        metadata[projectName].metadata.owners[ownerId].ownedFiles[0]
          ?.files[0] === '*'
      ) {
        continue;
      }
      // If the file pattern is '**/*', the owner owns the whole project
      if (filePattern === '**/*') {
        metadata[projectName].metadata.owners[ownerId].ownedFiles = [
          {
            files: ['*'],
            fromConfig,
          },
        ];
        continue;
      }
      const matchingProjectFiles = projectFiles.filter((file) => {
        return minimatch(
          file,
          joinPathFragments(projectNode.data.root, filePattern)
        );
      });
      // Owner owns a subset of files
      metadata[projectName].metadata.owners[ownerId].ownedFiles.push({
        files: matchingProjectFiles,
        fromConfig,
      });
    }
  }
}

type FromConfig = NonNullable<
  ProjectMetadata['owners']
>[string]['ownedFiles'][number]['fromConfig'];

function resolveFromConfigDataForJsonAtFilePath(
  filePath: string,
  jsonNode: Node | null,
  jsonContents: string,
  // Indices within arrays must be given as numbers for jsonc-parser
  jsonPath: (string | number)[]
): FromConfig | undefined {
  let fromConfig: FromConfig | undefined = undefined;
  if (jsonNode) {
    const node = findNodeAtLocation(jsonNode, jsonPath);
    if (node) {
      fromConfig = {
        filePath,
        location: computeJsonLineNumbers(
          jsonContents,
          node.offset,
          node.length
        ),
      };
    }
  }
  return fromConfig;
}

/**
 * Adapted from nx release internal utils
 */
function getJsonNode(rawConfig: string): Node | null {
  try {
    return parseTree(rawConfig) ?? null;
  } catch {
    return null;
  }
}

/**
 * Adapted from nx release internal utils
 */
function computeJsonLineNumbers(
  inputText: string,
  startOffset: number,
  characterCount: number
) {
  const lines = inputText.split('\n');
  let totalChars = 0;
  let startLine = 0;
  let endLine = 0;

  for (let i = 0; i < lines.length; i++) {
    totalChars += lines[i].length + 1; // +1 for '\n' character

    if (!startLine && totalChars >= startOffset) {
      startLine = i + 1; // +1 because arrays are 0-based
    }
    if (totalChars >= startOffset + characterCount) {
      endLine = i + 1; // +1 because arrays are 0-based
      break;
    }
  }

  if (!startLine) {
    throw new Error('Start offset exceeds the text length');
  }
  if (!endLine) {
    throw new Error(
      'Character count exceeds the text length after start offset'
    );
  }

  return { startLine, endLine };
}
