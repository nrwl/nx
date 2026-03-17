import { Schema } from '../schema';
import {
  getProjects,
  NxJsonConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
  updateProjectConfiguration,
} from '@nx/devkit';

export function removeProjectReferencesInConfig(tree: Tree, schema: Schema) {
  const nxJson = readNxJson(tree);
  let nxJsonChanged = false;

  // Unset default project if deleting the default project
  if (nxJson.defaultProject && nxJson.defaultProject === schema.projectName) {
    delete nxJson.defaultProject;
    nxJsonChanged = true;
  }

  // Remove project from conformance rules
  if (removeProjectFromConformanceRules(nxJson, schema.projectName)) {
    nxJsonChanged = true;
  }

  // Remove project from owners patterns
  if (removeProjectFromOwnersPatterns(nxJson, schema.projectName)) {
    nxJsonChanged = true;
  }

  if (nxJsonChanged) {
    updateNxJson(tree, nxJson);
  }

  // Remove implicit dependencies onto removed project
  getProjects(tree).forEach((project, projectName) => {
    if (
      project.implicitDependencies &&
      project.implicitDependencies.some(
        (projectName) => projectName === schema.projectName
      )
    ) {
      project.implicitDependencies = project.implicitDependencies.filter(
        (projectName) => projectName !== schema.projectName
      );
      updateProjectConfiguration(tree, projectName, project);
    }
  });
}

function removeProjectFromConformanceRules(
  nxJson: NxJsonConfiguration,
  projectName: string
): boolean {
  const conformance = nxJson['conformance'] as
    | { rules?: { projects?: (string | { matcher: string })[] }[] }
    | undefined;

  if (!conformance?.rules) {
    return false;
  }

  let changed = false;

  // Iterate backwards so that splicing doesn't shift unvisited indices
  for (let i = conformance.rules.length - 1; i >= 0; i--) {
    const rule = conformance.rules[i];
    if (!rule.projects) {
      continue;
    }

    const originalLength = rule.projects.length;
    rule.projects = rule.projects.filter((entry) => {
      if (typeof entry === 'string') {
        return entry !== projectName;
      }
      if (typeof entry === 'object' && entry.matcher) {
        return entry.matcher !== projectName;
      }
      return true;
    });

    if (rule.projects.length !== originalLength) {
      changed = true;
      if (rule.projects.length === 0) {
        conformance.rules.splice(i, 1);
      }
    }
  }

  return changed;
}

function removeProjectFromOwnersPatterns(
  nxJson: NxJsonConfiguration,
  projectName: string
): boolean {
  const owners = nxJson['owners'] as
    | {
        patterns?: { projects?: string[] }[];
        sections?: { patterns?: { projects?: string[] }[] }[];
      }
    | boolean
    | undefined;

  if (typeof owners !== 'object' || !owners) {
    return false;
  }

  let changed = false;

  // Filter top-level patterns
  if (owners.patterns) {
    if (filterOwnersPatternsList(owners.patterns, projectName)) {
      changed = true;
    }
  }

  // Filter section-level patterns (GitLab)
  if (owners.sections) {
    for (const section of owners.sections) {
      if (section.patterns) {
        if (filterOwnersPatternsList(section.patterns, projectName)) {
          changed = true;
        }
      }
    }
  }

  return changed;
}

function filterOwnersPatternsList(
  patterns: { projects?: string[] }[],
  projectName: string
): boolean {
  let changed = false;

  // Iterate backwards so that splicing doesn't shift unvisited indices
  for (let i = patterns.length - 1; i >= 0; i--) {
    const pattern = patterns[i];
    if (!pattern.projects) {
      continue;
    }

    const originalLength = pattern.projects.length;
    pattern.projects = pattern.projects.filter(
      (entry) => entry !== projectName
    );

    if (pattern.projects.length !== originalLength) {
      changed = true;
      if (pattern.projects.length === 0) {
        patterns.splice(i, 1);
      }
    }
  }

  return changed;
}
