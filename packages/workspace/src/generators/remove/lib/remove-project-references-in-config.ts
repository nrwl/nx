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
  for (const rule of conformance.rules) {
    if (!rule.projects) {
      continue;
    }

    const filtered = rule.projects.filter((entry) => {
      if (typeof entry === 'string') {
        return entry !== projectName;
      }
      if (typeof entry === 'object' && entry.matcher) {
        return entry.matcher !== projectName;
      }
      return true;
    });

    if (filtered.length !== rule.projects.length) {
      rule.projects = filtered;
      changed = true;
    }
  }

  return changed;
}

function removeProjectFromOwnersPatterns(
  nxJson: NxJsonConfiguration,
  projectName: string
): boolean {
  const owners = nxJson['owners'] as
    | { patterns?: { projects?: string[] }[] }
    | undefined;

  if (!owners?.patterns) {
    return false;
  }

  let changed = false;
  for (const pattern of owners.patterns) {
    if (!pattern.projects) {
      continue;
    }

    const filtered = pattern.projects.filter((entry) => entry !== projectName);

    if (filtered.length !== pattern.projects.length) {
      pattern.projects = filtered;
      changed = true;
    }
  }

  return changed;
}
