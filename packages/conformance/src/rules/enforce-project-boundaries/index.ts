import {
  DependencyType,
  type FileData,
  type ProjectFileMap,
  type ProjectGraph,
  type ProjectGraphProjectNode,
} from '@nx/devkit';
import { fileDataDepTarget, findMatchingProjects } from '@nx/devkit/internal';
import type { ConformanceViolation } from '../../types';
import { createConformanceRule } from '../../utils/create-conformance-rule';

type SingleSourceTagConstraint = {
  sourceTag: string;
  onlyDependOnProjectsWithTags?: string[];
  notDependOnProjectsWithTags?: string[];
};

type ComboSourceTagConstraint = {
  allSourceTags: string[];
  onlyDependOnProjectsWithTags?: string[];
  notDependOnProjectsWithTags?: string[];
};

type DepConstraint = SingleSourceTagConstraint | ComboSourceTagConstraint;

type RuleOptions = {
  requireBuildableDependenciesForBuildableProjects?:
    | boolean
    | {
        buildTargetNames: string[];
      };
  ignoredCircularDependencies?: Array<[string, string]>;
  depConstraints?: DepConstraint[];
  checkDynamicDependenciesExceptions?: string[];
};

const rule = createConformanceRule<RuleOptions>({
  name: 'enforce-project-boundaries',
  category: 'maintainability',
  description: 'Enforce project boundaries across the workspace.',
  implementation: async ({ projectGraph, fileMapCache, ruleOptions }) => {
    const fileMap = fileMapCache.fileMap.projectFileMap;
    const violations: ConformanceViolation[] = [];

    for (const [sourceProjectName, dependencies] of Object.entries(
      projectGraph.dependencies
    )) {
      const sourceProject = projectGraph.nodes[sourceProjectName];
      if (!sourceProject) {
        continue;
      }

      const localDependencies = dependencies.filter(
        (dep) => projectGraph.nodes[dep.target]
      );

      for (const dependency of localDependencies) {
        const targetProject = projectGraph.nodes[dependency.target];
        if (!targetProject) {
          continue;
        }

        violations.push(
          ...checkViolations(
            ruleOptions,
            sourceProject,
            targetProject,
            dependency.type as DependencyType,
            fileMap,
            projectGraph
          )
        );
      }
    }

    return {
      severity: 'medium',
      details: {
        violations,
      },
    };
  },
});

export default rule;

function checkViolations(
  ruleOptions: RuleOptions,
  sourceProject: ProjectGraph['nodes'][string],
  targetProject: ProjectGraph['nodes'][string],
  dependencyType: DependencyType,
  fileMap: ProjectFileMap,
  projectGraph: ProjectGraph
): ConformanceViolation[] {
  // Only compute project dependency files once for this combination of source and target projects
  let filesWithDataContainingProjectDependencies: FileData[] | undefined =
    undefined;
  let filesContainingProjectDependencies: string[] = [];

  const getFilesContainingProjectDependencies = <T extends boolean = false>(
    withData?: T
  ): T extends true ? FileData[] : string[] => {
    if (filesWithDataContainingProjectDependencies === undefined) {
      let filesWithData: FileData[] | undefined;

      // Implicit dependencies must have originated from nx configuration
      if (dependencyType === DependencyType.implicit) {
        const projectFiles = fileMap[sourceProject.name];
        filesWithData = projectFiles.filter((file) =>
          file.file.endsWith('project.json')
        );
      } else {
        filesWithData = findFileDataContainingProjectDependencies(
          sourceProject.name,
          targetProject.name,
          fileMap
        );
      }
      filesWithDataContainingProjectDependencies = filesWithData;
      filesContainingProjectDependencies = filesWithData.map(
        (file) => file.file
      );
    }

    return (
      withData
        ? filesWithDataContainingProjectDependencies
        : filesContainingProjectDependencies
    ) as T extends true ? FileData[] : string[];
  };

  const violations: ConformanceViolation[] = [];
  // Check for depending on apps. Implicit dependencies are deliberate configuration
  // (e.g. an e2e project declaring its app in implicitDependencies), not code coupling,
  // so they are allowed, matching the original eslint enforce-module-boundaries rule
  // which only ever saw static and dynamic imports.
  if (
    targetProject.type === 'app' &&
    dependencyType !== DependencyType.implicit
  ) {
    for (const file of getFilesContainingProjectDependencies()) {
      violations.push({
        sourceProject: sourceProject.name,
        message: `A dependency on an app project is forbidden (found "${targetProject.name}")`,
        file,
      });
    }
  }

  const expandedIgnoreCircularDependencies = expandIgnoredCircularDependencies(
    ruleOptions.ignoredCircularDependencies || [],
    projectGraph
  );

  // Check for depending on e2e projects
  if (targetProject.type === 'e2e') {
    for (const file of getFilesContainingProjectDependencies()) {
      violations.push({
        sourceProject: sourceProject.name,
        message: `A dependency on an e2e project is forbidden (found "${targetProject.name}")`,
        file,
      });
    }
  }

  // A buildable project cannot depend on a non-buildable project
  if (
    ruleOptions.requireBuildableDependenciesForBuildableProjects &&
    sourceProject.type === 'lib' &&
    targetProject.type === 'lib'
  ) {
    // true is a valid shorthand for the standard build target name
    const buildTargetNames =
      typeof ruleOptions.requireBuildableDependenciesForBuildableProjects ===
      'boolean'
        ? ['build']
        : ruleOptions.requireBuildableDependenciesForBuildableProjects
            .buildTargetNames;
    if (
      hasBuildExecutor(sourceProject, buildTargetNames) &&
      !hasBuildExecutor(targetProject, buildTargetNames)
    ) {
      for (const file of getFilesContainingProjectDependencies()) {
        violations.push({
          sourceProject: sourceProject.name,
          message: `A buildable project cannot depend on a non-buildable project (found "${targetProject.name}")`,
          file,
        });
      }
    }
  }

  // Check for circular dependencies
  const circularPath = checkCircularPath(
    projectGraph,
    sourceProject,
    targetProject
  );

  if (
    circularPath.length !== 0 &&
    !circularPathHasPair(circularPath, expandedIgnoreCircularDependencies)
  ) {
    for (const file of getFilesContainingProjectDependencies()) {
      violations.push({
        sourceProject: sourceProject.name,
        message: `Circular dependency detected: ${circularPath.map((node) => node.name).join(' <-> ')}`,
        file,
      });
    }
  }

  // check that dependency constraints are satisfied
  if (ruleOptions.depConstraints?.length) {
    const constraints = findConstraintsFor(
      ruleOptions.depConstraints,
      sourceProject
    );
    // when no constraints found => error. Force the user to provision them.
    if (constraints.length === 0) {
      for (const file of getFilesContainingProjectDependencies()) {
        violations.push({
          sourceProject: sourceProject.name,
          message: `A project without tags matching at least one entry in depConstraints cannot depend on any other projects (found "${targetProject.name}")`,
          file,
        });
      }
      return violations;
    }

    for (const constraint of ruleOptions.depConstraints) {
      const sourceTags = isComboDepConstraint(constraint)
        ? constraint.allSourceTags
        : [constraint.sourceTag];
      const hasSourceTags = sourceTags.some((tag) =>
        hasTag(sourceProject, tag)
      );
      if (!hasSourceTags) {
        continue;
      }

      if (
        constraint.onlyDependOnProjectsWithTags &&
        constraint.onlyDependOnProjectsWithTags.length &&
        hasNoneOfTheseTags(
          targetProject,
          constraint.onlyDependOnProjectsWithTags
        )
      ) {
        for (const file of getFilesContainingProjectDependencies()) {
          violations.push({
            sourceProject: sourceProject.name,
            message: `A project tagged with ${isComboDepConstraint(constraint) ? constraint.allSourceTags.join('" and "') : `"${constraint.sourceTag}"`} can only depend on projects with tags: ${stringifyTags(constraint.onlyDependOnProjectsWithTags)} (found "${targetProject.name}")`,
            file,
          });
        }
      }

      if (
        constraint.onlyDependOnProjectsWithTags &&
        constraint.onlyDependOnProjectsWithTags.length === 0 &&
        (targetProject.data.tags || []).length !== 0
      ) {
        for (const file of getFilesContainingProjectDependencies()) {
          violations.push({
            sourceProject: sourceProject.name,
            message: `A project tagged with ${isComboDepConstraint(constraint) ? constraint.allSourceTags.join('" and "') : `"${constraint.sourceTag}"`} cannot depend on any projects with tags (found "${targetProject.name}")`,
            file,
          });
        }
      }

      if (
        constraint.notDependOnProjectsWithTags &&
        constraint.notDependOnProjectsWithTags.length
      ) {
        const hasDisallowedTags = constraint.notDependOnProjectsWithTags.some(
          (tag) => hasTag(targetProject, tag)
        );
        if (hasDisallowedTags) {
          for (const file of getFilesContainingProjectDependencies()) {
            violations.push({
              sourceProject: sourceProject.name,
              message: `A project tagged with ${isComboDepConstraint(constraint) ? constraint.allSourceTags.join('" and "') : `"${constraint.sourceTag}"`} cannot depend on any projects with tags: ${stringifyTags(constraint.notDependOnProjectsWithTags)} (found "${targetProject.name}")`,
              file,
            });
          }
        }
      }
    }
  }
  return violations;
}

function findFileDataContainingProjectDependencies(
  sourceProjectName: string,
  targetProjectName: string,
  fileMap: ProjectFileMap
): FileData[] {
  const sourceProjectFiles = fileMap[sourceProjectName] || [];
  return sourceProjectFiles.filter((fileData) =>
    fileData.deps?.some((dep) => fileDataDepTarget(dep) === targetProjectName)
  );
}

// ---------- THE FOLLOWING CODE IS PORTED FROM packages/eslint-plugin/src/utils/graph-utils.ts ----------

interface Reach {
  graph: ProjectGraph;
  matrix: Record<string, Array<string>>;
  adjList: Record<string, Array<string>>;
}

const reach: Reach = {
  graph: {} as ProjectGraph,
  matrix: {} as Record<string, string[]>,
  adjList: {} as Record<string, string[]>,
};

function checkCircularPath(
  graph: ProjectGraph,
  sourceProject: ProjectGraphProjectNode,
  targetProject: ProjectGraphProjectNode
): ProjectGraphProjectNode[] {
  if (!graph.nodes[targetProject.name]) return [];

  return getPath(graph, targetProject.name, sourceProject.name);
}

function buildMatrix(graph: ProjectGraph) {
  const nodes = Object.keys(graph.nodes);
  const nodesLength = nodes.length;
  const adjList = {};
  const matrix = {};

  // create matrix value set
  for (let i = 0; i < nodesLength; i++) {
    const v = nodes[i];
    adjList[v] = [];
    // meeroslav: turns out this is 10x faster than spreading the pre-generated initMatrixValues
    matrix[v] = {};
  }

  const projectsWithDependencies = Object.keys(graph.dependencies);
  for (let i = 0; i < projectsWithDependencies.length; i++) {
    const dependencies = graph.dependencies[projectsWithDependencies[i]];
    for (let j = 0; j < dependencies.length; j++) {
      const dependency = dependencies[j];
      if (graph.nodes[dependency.target]) {
        adjList[dependency.source].push(dependency.target);
      }
    }
  }

  const traverse = (s: string, v: string) => {
    matrix[s][v] = true;

    const adjListLength = adjList[v].length;
    for (let i = 0; i < adjListLength; i++) {
      const adj = adjList[v][i];
      if (!matrix[s][adj]) {
        traverse(s, adj);
      }
    }
  };

  for (let i = 0; i < nodesLength; i++) {
    const v = nodes[i];
    traverse(v, v);
  }

  return {
    matrix,
    adjList,
  };
}

function getPath(
  graph: ProjectGraph,
  sourceProjectName: string,
  targetProjectName: string
): Array<ProjectGraphProjectNode> {
  if (sourceProjectName === targetProjectName) return [];

  if (reach.graph !== graph) {
    const { matrix, adjList } = buildMatrix(graph);
    reach.graph = graph;
    reach.matrix = matrix;
    reach.adjList = adjList;
  }

  const adjList = reach.adjList;

  let path: string[] = [];
  const queue: Array<[string, string[]]> = [[sourceProjectName, path]];
  const visited: string[] = [sourceProjectName];

  while (queue.length > 0) {
    const [current, p] = queue.pop() || ['', []];
    path = [...p, current];

    if (current === targetProjectName) break;

    if (!adjList[current]) break;

    adjList[current]
      .filter((adj) => visited.indexOf(adj) === -1)
      .filter((adj) => reach.matrix[adj][targetProjectName])
      .forEach((adj) => {
        visited.push(adj);
        queue.push([adj, [...path]]);
      });
  }

  if (path.length > 1) {
    return path.map((n) => graph.nodes[n] as ProjectGraphProjectNode);
  } else {
    return [];
  }
}

function expandIgnoredCircularDependencies(
  ignoredCircularDependencies: Array<[string, string]>,
  projectGraph: ProjectGraph
) {
  const allowed = new Map<string, Set<string>>();

  for (const [a, b] of ignoredCircularDependencies) {
    const setA = new Set(findMatchingProjects([a], projectGraph.nodes));
    const setB = new Set(findMatchingProjects([b], projectGraph.nodes));

    for (const projectA of setA) {
      if (!allowed.has(projectA)) {
        allowed.set(projectA, new Set<string>());
      }
      const currentSetA = allowed.get(projectA);

      for (const projectB of setB) {
        currentSetA?.add(projectB);
      }
    }

    for (const projectB of setB) {
      if (!allowed.has(projectB)) {
        allowed.set(projectB, new Set<string>());
      }
      const currentSetB = allowed.get(projectB);

      for (const projectA of setA) {
        currentSetB?.add(projectA);
      }
    }
  }

  return allowed;
}

function circularPathHasPair(
  circularPath: ProjectGraphProjectNode[],
  ignored: Map<string, Set<string>>
): boolean {
  if (circularPath.length < 2) return false;

  for (let i = 0; i < circularPath.length - 1; i++) {
    const dependencyIsIgnored = ignored
      .get(circularPath[i].name)
      ?.has(circularPath[i + 1].name);

    if (dependencyIsIgnored) {
      return true;
    }
  }

  return false;
}

// ---------- THE FOLLOWING CODE IS PORTED FROM packages/eslint-plugin/src/utils/runtime-lint-utils.ts ----------

function findConstraintsFor(
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

function isComboDepConstraint(
  depConstraint: DepConstraint
): depConstraint is ComboSourceTagConstraint {
  return !!(depConstraint as ComboSourceTagConstraint).allSourceTags;
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

function stringifyTags(tags: string[]): string {
  return tags.map((t) => `"${t}"`).join(', ');
}

function hasNoneOfTheseTags(
  proj: ProjectGraphProjectNode,
  tags: string[]
): boolean {
  return tags.filter((tag) => hasTag(proj, tag)).length === 0;
}

function hasBuildExecutor(
  projectGraph: ProjectGraphProjectNode,
  buildTargets = ['build']
): boolean {
  return !!(
    projectGraph.data.targets &&
    buildTargets.some(
      (target) =>
        projectGraph.data.targets?.[target] &&
        projectGraph.data.targets?.[target].executor !== ''
    )
  );
}
