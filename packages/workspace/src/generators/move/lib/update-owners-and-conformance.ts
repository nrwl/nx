import {
  NxJsonConfiguration,
  readNxJson,
  Tree,
  updateNxJson,
} from '@nx/devkit';
import { NormalizedSchema } from '../schema';

export function updateOwnersAndConformance(
  tree: Tree,
  schema: NormalizedSchema
) {
  const nxJson = readNxJson(tree);
  let changed = false;

  if (
    renameProjectInConformanceRules(
      nxJson,
      schema.projectName,
      schema.newProjectName
    )
  ) {
    changed = true;
  }

  if (
    renameProjectInOwnersPatterns(
      nxJson,
      schema.projectName,
      schema.newProjectName
    )
  ) {
    changed = true;
  }

  if (changed) {
    updateNxJson(tree, nxJson);
  }
}

function renameProjectInConformanceRules(
  nxJson: NxJsonConfiguration,
  oldName: string,
  newName: string
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

    for (let i = 0; i < rule.projects.length; i++) {
      const entry = rule.projects[i];
      if (typeof entry === 'string' && entry === oldName) {
        rule.projects[i] = newName;
        changed = true;
      } else if (typeof entry === 'object' && entry.matcher === oldName) {
        entry.matcher = newName;
        changed = true;
      }
    }
  }

  return changed;
}

function renameProjectInOwnersPatterns(
  nxJson: NxJsonConfiguration,
  oldName: string,
  newName: string
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

  if (owners.patterns) {
    if (renameInPatternsList(owners.patterns, oldName, newName)) {
      changed = true;
    }
  }

  if (owners.sections) {
    for (const section of owners.sections) {
      if (section.patterns) {
        if (renameInPatternsList(section.patterns, oldName, newName)) {
          changed = true;
        }
      }
    }
  }

  return changed;
}

function renameInPatternsList(
  patterns: { projects?: string[] }[],
  oldName: string,
  newName: string
): boolean {
  let changed = false;

  for (const pattern of patterns) {
    if (!pattern.projects) {
      continue;
    }

    for (let i = 0; i < pattern.projects.length; i++) {
      if (pattern.projects[i] === oldName) {
        pattern.projects[i] = newName;
        changed = true;
      }
    }
  }

  return changed;
}
