import {
  DependencyType,
  joinPathFragments,
  normalizePath,
  parseJson,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphExternalNode,
  ProjectGraphProjectNode,
  workspaceRoot,
} from '@nx/devkit';
import { getRootTsConfigFileName } from '@nx/js';
import {
  resolveModuleByImport,
  TargetProjectLocator,
} from '@nx/js/src/internal';
import { AST_NODE_TYPES, TSESLint, TSESTree } from '@typescript-eslint/utils';
import * as path from 'node:path';
import {
  findProjectForPath,
  ProjectRootMappings,
} from 'nx/src/project-graph/utils/find-project-for-path';
import { readFileIfExisting } from 'nx/src/utils/fileutils';
import { getPath, pathExists } from './graph-utils';

export type Deps = { [projectName: string]: ProjectGraphDependency[] };
type SingleSourceTagConstraint = {
  sourceTag: string;
  onlyDependOnLibsWithTags?: string[];
  notDependOnLibsWithTags?: string[];
  allowedExternalImports?: string[];
  bannedExternalImports?: string[];
};
type ComboSourceTagConstraint = {
  allSourceTags: string[];
  onlyDependOnLibsWithTags?: string[];
  notDependOnLibsWithTags?: string[];
  allowedExternalImports?: string[];
  bannedExternalImports?: string[];
};
export type DepConstraint =
  | SingleSourceTagConstraint
  | ComboSourceTagConstraint;

export function stringifyTags(tags: string[]): string {
  return tags.map((t) => `"${t}"`).join(', ');
}

export function hasNoneOfTheseTags(
  proj: ProjectGraphProjectNode,
  tags: string[]
): boolean {
  return tags.filter((tag) => hasTag(proj, tag)).length === 0;
}

export function isComboDepConstraint(
  depConstraint: DepConstraint
): depConstraint is ComboSourceTagConstraint {
  return !!(depConstraint as ComboSourceTagConstraint).allSourceTags;
}

/**
 * Check if any of the given tags is included in the project
 * @param proj ProjectGraphProjectNode
 * @param tags
 * @returns
 */
export function findDependenciesWithTags(
  targetProject: ProjectGraphProjectNode,
  tags: string[],
  graph: ProjectGraph
): ProjectGraphProjectNode[][] {
  // find all reachable projects that have one of the tags and
  // are reacheable from the targetProject (including self)
  const allReachableProjects = Object.keys(graph.nodes).filter(
    (projectName) =>
      pathExists(graph, targetProject.name, projectName) &&
      tags.some((tag) => hasTag(graph.nodes[projectName], tag))
  );

  // return path from targetProject to reachable project
  return allReachableProjects.map((project) =>
    targetProject.name === project
      ? [targetProject]
      : getPath(graph, targetProject.name, project)
  );
}

const regexMap = new Map<string, RegExp>();

function hasTag(proj: ProjectGraphProjectNode, tag: string): boolean {
  if (tag === '*') return true;

  // if the tag is a regex, check if the project matches the regex
  if (tag.startsWith('/') && tag.endsWith('/')) {
    let regex;
    if (regexMap.has(tag)) {
      regex = regexMap.get(tag);
    } else {
      regex = new RegExp(tag.substring(1, tag.length - 1));
      regexMap.set(tag, regex);
    }
    return (proj.data.tags || []).some((t) => regex.test(t));
  }

  // if the tag is a glob, check if the project matches the glob prefix
  if (tag.includes('*')) {
    const regex = mapGlobToRegExp(tag);
    return (proj.data.tags || []).some((t) => regex.test(t));
  }

  return (proj.data.tags || []).indexOf(tag) > -1;
}

export function matchImportWithWildcard(
  // This may or may not contain wildcards ("*")
  allowableImport: string,
  extractedImport: string
): boolean {
  if (allowableImport.endsWith('/**')) {
    const prefix = allowableImport.substring(0, allowableImport.length - 2);
    return extractedImport.startsWith(prefix);
  } else if (allowableImport.endsWith('/*')) {
    const prefix = allowableImport.substring(0, allowableImport.length - 1);
    if (!extractedImport.startsWith(prefix)) return false;
    return extractedImport.substring(prefix.length).indexOf('/') === -1;
  } else if (allowableImport.indexOf('/**/') > -1) {
    const [prefix, suffix] = allowableImport.split('/**/');
    return (
      extractedImport.startsWith(prefix) && extractedImport.endsWith(suffix)
    );
  } else {
    return new RegExp(allowableImport).test(extractedImport);
  }
}

export function isRelative(s: string) {
  return s.startsWith('./') || s.startsWith('../');
}

export function getTargetProjectBasedOnRelativeImport(
  imp: string,
  projectPath: string,
  projectGraph: ProjectGraph,
  projectRootMappings: ProjectRootMappings,
  sourceFilePath: string
): ProjectGraphProjectNode | undefined {
  if (!isRelative(imp)) {
    return undefined;
  }
  const sourceDir = path.join(projectPath, path.dirname(sourceFilePath));

  const targetFile = normalizePath(path.resolve(sourceDir, imp)).substring(
    projectPath.length + 1
  );

  return findProject(projectGraph, projectRootMappings, targetFile);
}

export function findProject(
  projectGraph: ProjectGraph,
  projectRootMappings: ProjectRootMappings,
  sourceFilePath: string
) {
  return projectGraph.nodes[
    findProjectForPath(sourceFilePath, projectRootMappings)
  ];
}

export function isAbsoluteImportIntoAnotherProject(
  imp: string,
  workspaceLayout = { libsDir: 'libs', appsDir: 'apps' }
) {
  return (
    imp.startsWith(`${workspaceLayout.libsDir}/`) ||
    imp.startsWith(`/${workspaceLayout.libsDir}/`) ||
    imp.startsWith(`${workspaceLayout.appsDir}/`) ||
    imp.startsWith(`/${workspaceLayout.appsDir}/`)
  );
}

export function findProjectUsingImport(
  projectGraph: ProjectGraph,
  targetProjectLocator: TargetProjectLocator,
  filePath: string,
  imp: string
): ProjectGraphProjectNode | ProjectGraphExternalNode {
  const target = targetProjectLocator.findProjectFromImport(imp, filePath);
  return projectGraph.nodes[target] || projectGraph.externalNodes?.[target];
}

export function findConstraintsFor(
  depConstraints: DepConstraint[],
  sourceProject: ProjectGraphProjectNode
) {
  return depConstraints.filter((f) => {
    if (isComboDepConstraint(f)) {
      return f.allSourceTags.every((tag) => hasTag(sourceProject, tag));
    } else {
      return hasTag(sourceProject, f.sourceTag);
    }
  });
}

export function hasStaticImportOfDynamicResource(
  node:
    | TSESTree.ImportDeclaration
    | TSESTree.ImportExpression
    | TSESTree.ExportAllDeclaration
    | TSESTree.ExportNamedDeclaration,
  graph: ProjectGraph,
  sourceProjectName: string,
  targetProjectName: string,
  importExpr: string,
  filePath: string
): boolean {
  if (
    node.type !== AST_NODE_TYPES.ImportDeclaration ||
    node.importKind === 'type'
  ) {
    return false;
  }
  return (
    hasDynamicImport(graph, sourceProjectName, targetProjectName, []) &&
    !getSecondaryEntryPointPath(
      importExpr,
      filePath,
      graph.nodes[targetProjectName].data.root
    )
  );
}

function hasDynamicImport(
  graph: ProjectGraph,
  sourceProjectName: string,
  targetProjectName: string,
  visited: string[]
) {
  if (visited.indexOf(sourceProjectName) > -1) {
    return false;
  }
  return (
    (graph.dependencies[sourceProjectName] || []).filter((d) => {
      if (d.type !== DependencyType.dynamic) {
        return false;
      }
      if (d.target === targetProjectName) {
        return true;
      }
      return hasDynamicImport(graph, d.target, targetProjectName, [
        ...visited,
        sourceProjectName,
      ]);
    }).length > 0
  );
}

export function getSourceFilePath(sourceFileName: string, projectPath: string) {
  const normalizedProjectPath = normalizePath(projectPath);
  const normalizedSourceFileName = normalizePath(sourceFileName);
  return normalizedSourceFileName.slice(normalizedProjectPath.length + 1);
}

/**
 * Find constraint (if any) that explicitly banns the given target npm project
 * @param externalProject
 * @param depConstraints
 * @returns
 */
function isConstraintBanningProject(
  externalProject: ProjectGraphExternalNode,
  constraint: DepConstraint,
  imp: string
): boolean {
  const { allowedExternalImports, bannedExternalImports } = constraint;
  const { packageName } = externalProject.data;

  if (imp !== packageName && !imp.startsWith(`${packageName}/`)) {
    return false;
  }

  /* Check if import is banned... */
  if (
    bannedExternalImports?.some((importDefinition) =>
      mapGlobToRegExp(importDefinition).test(imp)
    )
  ) {
    return true;
  }

  /* ... then check if there is a whitelist and if there is a match in the whitelist.  */
  return allowedExternalImports?.every(
    (importDefinition) =>
      !imp.startsWith(packageName) ||
      !mapGlobToRegExp(importDefinition).test(imp)
  );
}

export function hasBannedImport(
  source: ProjectGraphProjectNode,
  target: ProjectGraphExternalNode,
  depConstraints: DepConstraint[],
  imp: string
): DepConstraint | undefined {
  // return those constraints that match source project
  depConstraints = depConstraints.filter((c) => {
    let tags = [];
    if (isComboDepConstraint(c)) {
      tags = c.allSourceTags;
    } else {
      tags = [c.sourceTag];
    }

    return tags.every((t) => hasTag(source, t));
  });
  return depConstraints.find((constraint) =>
    isConstraintBanningProject(target, constraint, imp)
  );
}

/**
 * Find all unique (transitive) external dependencies of given project
 * @param graph
 * @param source
 * @returns
 */
export function findTransitiveExternalDependencies(
  graph: ProjectGraph,
  source: ProjectGraphProjectNode
): ProjectGraphDependency[] {
  if (!graph.externalNodes) {
    return [];
  }
  const allReachableProjects = [];
  const allProjects = Object.keys(graph.nodes);

  for (let i = 0; i < allProjects.length; i++) {
    if (pathExists(graph, source.name, allProjects[i])) {
      allReachableProjects.push(allProjects[i]);
    }
  }

  const externalDependencies = [];
  for (let i = 0; i < allReachableProjects.length; i++) {
    const dependencies = graph.dependencies[allReachableProjects[i]];
    if (dependencies) {
      for (let d = 0; d < dependencies.length; d++) {
        const dependency = dependencies[d];
        if (graph.externalNodes[dependency.target]) {
          externalDependencies.push(dependency);
        }
      }
    }
  }

  return externalDependencies;
}

/**
 * Check if
 * @param externalDependencies
 * @param graph
 * @param depConstraint
 * @returns
 */
export function hasBannedDependencies(
  externalDependencies: ProjectGraphDependency[],
  graph: ProjectGraph,
  depConstraint: DepConstraint,
  imp: string
):
  | Array<[ProjectGraphExternalNode, ProjectGraphProjectNode, DepConstraint]>
  | undefined {
  return externalDependencies
    .filter((dependency) =>
      isConstraintBanningProject(
        graph.externalNodes[dependency.target],
        depConstraint,
        imp
      )
    )
    .map((dep) => [
      graph.externalNodes[dep.target],
      graph.nodes[dep.source],
      depConstraint,
    ]);
}

export function isDirectDependency(
  source: ProjectGraphProjectNode,
  target: ProjectGraphExternalNode
): boolean {
  return (
    packageExistsInPackageJson(target.data.packageName, '.') ||
    packageExistsInPackageJson(target.data.packageName, source.data.root)
  );
}

function packageExistsInPackageJson(
  packageName: string,
  projectRoot: string
): boolean {
  const content = readFileIfExisting(
    path.join(workspaceRoot, projectRoot, 'package.json')
  );
  if (content) {
    const { dependencies, devDependencies, peerDependencies } =
      parseJson(content);
    if (dependencies && dependencies[packageName]) {
      return true;
    }
    if (peerDependencies && peerDependencies[packageName]) {
      return true;
    }
    if (devDependencies && devDependencies[packageName]) {
      return true;
    }
  }

  return false;
}

/**
 * Maps import with wildcards to regex pattern
 * @param importDefinition
 * @returns
 */
function mapGlobToRegExp(importDefinition: string): RegExp {
  // we replace all instances of `*`, `**..*` and `.*` with `.*`
  const mappedWildcards = importDefinition.split(/(?:\.\*)|\*+/).join('.*');
  return new RegExp(`^${new RegExp(mappedWildcards).source}$`);
}

/**
 * Verifies whether the given node has a builder target
 * @param projectGraph the node to verify
 * @param buildTargets the list of targets to check for
 */
export function hasBuildExecutor(
  projectGraph: ProjectGraphProjectNode,
  buildTargets = ['build']
): boolean {
  return (
    projectGraph.data.targets &&
    buildTargets.some(
      (target) =>
        projectGraph.data.targets[target] &&
        projectGraph.data.targets[target].executor !== ''
    )
  );
}

const ESLINT_REGEX = /node_modules.*[\/\\]eslint(?:\.js)?$/;
const JEST_REGEX = /node_modules\/.bin\/jest$/; // when we run unit tests in jest
const NRWL_CLI_REGEX = /nx[\/\\]bin[\/\\]run-executor\.js$/;

export function isTerminalRun(): boolean {
  return (
    process.argv.length > 1 &&
    (!!process.argv[1].match(NRWL_CLI_REGEX) ||
      !!process.argv[1].match(JEST_REGEX) ||
      !!process.argv[1].match(ESLINT_REGEX) ||
      !!process.argv[1].endsWith('/bin/jest.js'))
  );
}

/**
 * Takes an array of imports and tries to group them, so rather than having
 * `import { A } from './some-location'` and `import { B } from './some-location'` you get
 * `import { A, B } from './some-location'`
 * @param importsToRemap
 * @returns
 */
export function groupImports(
  importsToRemap: { member: string; importPath: string }[]
): string {
  const importsToRemapGrouped = importsToRemap.reduce((acc, curr) => {
    const existing = acc.find(
      (i) => i.importPath === curr.importPath && i.member !== curr.member
    );
    if (existing) {
      if (existing.member) {
        existing.member += `, ${curr.member}`;
      }
    } else {
      acc.push({
        importPath: curr.importPath,
        member: curr.member,
      });
    }
    return acc;
  }, []);

  return importsToRemapGrouped
    .map((entry) => `import { ${entry.member} } from '${entry.importPath}';`)
    .join('\n');
}

/**
 * Checks if source file belongs to a secondary entry point different than the import one
 */
export function belongsToDifferentEntryPoint(
  importExpr: string,
  filePath: string,
  projectRoot: string
): boolean {
  const importEntryPoint = getSecondaryEntryPointPath(
    importExpr,
    filePath,
    projectRoot
  );
  const srcEntryPoint = getEntryPoint(filePath, projectRoot);

  // check if the entry point of import expression is different than the source file's entry point
  return importEntryPoint !== srcEntryPoint;
}

export function getSecondaryEntryPointPath(
  importExpr: string,
  filePath: string,
  projectRoot: string
): string | undefined {
  const resolvedImportFile = resolveModuleByImport(
    importExpr,
    filePath, // not strictly necessary, but speeds up resolution
    path.join(workspaceRoot, getRootTsConfigFileName())
  );
  if (!resolvedImportFile) {
    return undefined;
  }
  const entryPoint = getEntryPoint(resolvedImportFile, projectRoot);
  return entryPoint;
}

function getEntryPoint(file: string, projectRoot: string): string {
  const packageEntryPoints = getPackageEntryPoints(projectRoot);
  const fileEntryPoint = packageEntryPoints.find(
    (entry) => entry.file === file
  );
  if (fileEntryPoint) {
    return fileEntryPoint.file;
  }

  let parent = joinPathFragments(file, '../');
  while (parent !== `${projectRoot}/`) {
    const entryPoint = packageEntryPoints.find(
      (entry) => entry.path === parent
    );
    if (entryPoint) {
      return entryPoint.file;
    }
    // for Angular we need to find closest existing ng-package.json
    // in order to determine if the file matches the secondary entry point
    const ngPackageContent = readFileIfExisting(
      path.join(workspaceRoot, parent, 'ng-package.json')
    );
    if (ngPackageContent) {
      // https://github.com/ng-packagr/ng-packagr/blob/23c718d04eea85e015b4c261310b7bd0c39e5311/src/ng-package.schema.json#L54
      const entryFile = parseJson(ngPackageContent)?.lib?.entryFile;
      return joinPathFragments(parent, entryFile);
    }
    parent = joinPathFragments(parent, '../');
  }
  return undefined;
}

function getPackageEntryPoints(
  projectRoot: string
): Array<{ path: string; file: string }> {
  const packageContent = readFileIfExisting(
    path.join(workspaceRoot, projectRoot, 'package.json')
  );
  if (!packageContent) {
    return [];
  }
  const exports = parseJson(packageContent).exports;
  if (!exports) {
    return [];
  }
  const entryPaths: Array<{ path: string; file: string }> = [];
  parseExports(exports, projectRoot, entryPaths);
  return entryPaths;
}

export function parseExports(
  exports: string | null | Record<string, any>,
  projectRoot: string,
  entryPaths: Array<{ path: string; file: string }>,
  basePath: string = '.'
): Array<{ path: string; file: string }> {
  if (exports === null) {
    return;
  }
  if (typeof exports === 'string') {
    if (basePath === '.') {
      return;
    } else {
      entryPaths.push({
        path: joinPathFragments(projectRoot, basePath),
        file: joinPathFragments(projectRoot, exports),
      });
      return;
    }
  }

  // parse conditional exports
  if (exports.import || exports.require || exports.default || exports.node) {
    parseExports(
      exports.default || exports.import || exports.require || exports.node,
      projectRoot,
      entryPaths,
      basePath
    );
    return;
  }

  // parse general nested exports
  for (const [key, value] of Object.entries(exports)) {
    parseExports(value, projectRoot, entryPaths, key);
  }
}

/**
 * Returns true if the given project contains MFE config with "exposes:" section
 */
export function appIsMFERemote(project: ProjectGraphProjectNode): boolean {
  const mfeConfig =
    readFileIfExisting(
      path.join(workspaceRoot, project.data.root, 'module-federation.config.js')
    ) ||
    readFileIfExisting(
      path.join(workspaceRoot, project.data.root, 'module-federation.config.ts')
    );

  if (mfeConfig) {
    return !!mfeConfig.match(/('|")?exposes('|")?:/);
  }

  return false;
}

/**
 * parserServices moved from the context object to the nested sourceCode object in v8,
 * and was removed from its original location in v9.
 */
export function getParserServices(
  context: Readonly<TSESLint.RuleContext<any, any>>
): any {
  if (context.sourceCode && context.sourceCode.parserServices) {
    return context.sourceCode.parserServices;
  }
  const parserServices = context.parserServices;
  if (!parserServices) {
    throw new Error(
      'Parser Services are not available, please check your ESLint configuration'
    );
  }
  return parserServices;
}
