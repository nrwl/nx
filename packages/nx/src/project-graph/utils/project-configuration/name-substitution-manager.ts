import { ProjectGraphProjectNode } from '../../../config/project-graph';
import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { isGlobPattern } from '../../../utils/globs';
import { splitTargetFromNodes } from '../../../utils/split-target';
import { minimatch } from 'minimatch';

// A substitutor receives the final resolved name of the project that was
// renamed, and the final merged configuration of the project that *holds
// the stale reference* so it can update the appropriate field in-place.
type ProjectNameSubstitutor = (
  finalName: string,
  ownerProjectConfig: ProjectConfiguration
) => void;

// Pairs a substitutor with the root of the project whose configuration it
// will update. Stored together so applySubstitutions can look up
// rootMap[ownerRoot] without passing the full map into each substitutor.
type SubstitutorEntry = {
  ownerRoot: string;
  substitutor: ProjectNameSubstitutor;
};

/**
 * Manages deferred project name substitutions across the plugin result
 * merge phase of project graph construction.
 *
 * ### Why this exists
 *
 * When plugins return `createNodes` results, a node `A` may declare a
 * `dependsOn` or `inputs` entry that references another project `B` by
 * name. A *later* plugin is allowed to rename project `B` to `C`. After
 * all plugin results are merged into the root map, node `A` would still
 * hold a stale reference to the now-nonexistent name `B`.
 *
 * This class solves that by:
 * 1. Scanning each plugin's results for project-name references in
 *    `inputs` and `dependsOn` ({@link registerSubstitutorsForNodeResults}).
 *    Substitutors are indexed by the **referenced name as it appeared in
 *    the plugin result** — no lookup into any project map is needed at
 *    registration time.
 * 2. When a project's name changes during the merge, recording that change
 *    via {@link markDirty} so substitutors for the old name can be located.
 * 3. After all results are merged, applying the substitutors for every
 *    renamed project so that references are updated to the final name
 *    ({@link applySubstitutions}).
 */
export class ProjectNameInNodePropsManager {
  // ── Why two maps? ──────────────────────────────────────────────────
  // Substitutors must be keyed by *root* (not name) so that a rename
  // A → B at root X does not accidentally rewrite references to a
  // *different* project that now occupies the name "A" at root Y.
  // However, at registration time the referenced project may not yet
  // exist (forward reference), so its root is unknown. In that case
  // we fall back to keying by name. applySubstitutions consults both
  // maps: root-keyed first (covers the common resolved case), then
  // name-keyed (covers the forward-reference fallback).
  // ─────────────────────────────────────────────────────────────────

  // Maps the *root of the referenced project* → set of substitutor entries
  // that should run when that project is renamed. Keying by root (resolved
  // at registration time via knownProjectNodes) ensures that when project
  // "A" is renamed to "B" and a *new* project takes the name "A" at a
  // different root, references to the new "A" are not incorrectly rewritten.
  private substitutorsByReferencedRoot = new Map<
    string,
    Set<SubstitutorEntry>
  >();

  // Fallback map for references whose name could not be resolved to a root
  // at registration time (forward references to projects not yet seen).
  // Keyed by the referenced project name.
  private substitutorsByUnresolvedName = new Map<
    string,
    Set<SubstitutorEntry>
  >();

  // Tracks substitutor entries by (array path, index, subIndex). This
  // serves two purposes:
  //
  // 1. Per-index deduplication: if the same array index is registered
  //    again (e.g. two plugin results contribute to the same position),
  //    the old substitutor is evicted before the new one is added.
  //
  // 2. Tail-clearing: when a later plugin provides a shorter array at the
  //    same path, splice removes all tail entries in one call.
  //
  // Outer key: array path (e.g. "proj-a:targets.build.inputs")
  // Inner array: indexed by position; each slot holds an array so that a
  //   single `projects` array can hold multiple name references.
  private substitutorsByArrayKey = new Map<
    string,
    Array<
      | Array<
          | {
              mapKey: string;
              keyedByRoot: boolean;
              entry: SubstitutorEntry;
            }
          | undefined
        >
      | undefined
    >
  >();

  // Projects whose names changed during the merge phase. Key = root of the
  // renamed project, value = all names it previously held in this merge.
  // The root is used to locate root-keyed substitutors directly, and
  // previousNames are used as a fallback for name-keyed substitutors.
  private dirtyEntries = new Map<string, Set<string>>();

  // Partial project graph nodes accumulated across plugin registrations.
  // Used by splitTargetFromNodes to properly parse string-form dependsOn
  // entries like "project:target" — including project / target names that
  // contain colons.
  private knownProjectNodes: Record<string, ProjectGraphProjectNode> = {};

  private removeSubstitutorEntry(item: {
    mapKey: string;
    keyedByRoot: boolean;
    entry: SubstitutorEntry;
  }) {
    const map = item.keyedByRoot
      ? this.substitutorsByReferencedRoot
      : this.substitutorsByUnresolvedName;
    const substitutors = map.get(item.mapKey);
    if (!substitutors) {
      return;
    }
    substitutors.delete(item.entry);
    if (substitutors.size === 0) {
      map.delete(item.mapKey);
    }
  }

  // Removes the substitutor registered at the given index (and optional
  // subIndex) of an array, if any. Used when re-registering for the same
  // position (overwritten by a later plugin).
  private clearSubstitutorAtIndex(
    arrayKey: string,
    index: number,
    subIndex?: number
  ) {
    const byIndex = this.substitutorsByArrayKey.get(arrayKey);
    const atIndex = byIndex?.[index];
    if (!atIndex) {
      return;
    }
    if (subIndex === undefined) {
      // Clear the entire index entry (single project reference)
      for (const item of atIndex) {
        if (item) {
          this.removeSubstitutorEntry(item);
        }
      }
      byIndex[index] = undefined;
    } else {
      // Clear only the specific subIndex (within a projects array)
      const existing = atIndex[subIndex];
      if (existing) {
        this.removeSubstitutorEntry(existing);
        atIndex[subIndex] = undefined;
      }
    }
  }

  // Removes all substitutors at indices >= `fromIndex` for the given array
  // path. Uses splice so the tail is dropped in one operation.
  private clearSubstitutorsFromIndex(arrayKey: string, fromIndex: number) {
    const byIndex = this.substitutorsByArrayKey.get(arrayKey);
    if (!byIndex) {
      return;
    }
    const removed = byIndex.splice(fromIndex);
    for (const atIndex of removed) {
      if (atIndex) {
        for (const item of atIndex) {
          if (item) {
            this.removeSubstitutorEntry(item);
          }
        }
      }
    }
  }

  // Removes all substitutors at sub-indices >= `fromSubIndex` for one
  // specific array index of the given array key.
  private clearSubstitutorsFromSubIndex(
    arrayKey: string,
    index: number,
    fromSubIndex: number
  ) {
    const byIndex = this.substitutorsByArrayKey.get(arrayKey);
    const atIndex = byIndex?.[index];
    if (!atIndex) {
      return;
    }

    const removed = atIndex.splice(fromSubIndex);
    for (const item of removed) {
      if (item) {
        this.removeSubstitutorEntry(item);
      }
    }

    let hasAnyItem = false;
    for (const item of atIndex) {
      if (item) {
        hasAnyItem = true;
        break;
      }
    }

    if (!hasAnyItem) {
      byIndex[index] = undefined;
    }
  }

  private forEachTargetConfig(
    ownerConfig: ProjectConfiguration,
    targetName: string,
    callback: (
      targetConfig: NonNullable<ProjectConfiguration['targets'][string]>
    ) => void
  ) {
    const ownerTargets = ownerConfig.targets;
    if (!ownerTargets) {
      return;
    }

    const exactMatch = ownerTargets[targetName];
    if (exactMatch && typeof exactMatch === 'object') {
      callback(exactMatch);
      return;
    }

    if (!isGlobPattern(targetName)) {
      return;
    }

    for (const candidateTargetName in ownerTargets) {
      if (!minimatch(candidateTargetName, targetName)) {
        continue;
      }

      const targetConfig = ownerTargets[candidateTargetName];
      if (!targetConfig || typeof targetConfig !== 'object') {
        continue;
      }

      callback(targetConfig);
    }
  }

  // Registers a new substitutor for `referencedName`, tracked at
  // (arrayKey, index, subIndex) for deduplication and tail-clearing.
  // The substitutor is keyed by the referenced project's *root* when the
  // name can be resolved via knownProjectNodes, or by name as a fallback.
  private registerProjectNameSubstitutor(
    referencedName: string,
    ownerRoot: string,
    arrayKey: string,
    index: number,
    substitutor: ProjectNameSubstitutor,
    subIndex?: number
  ) {
    // Evict any existing substitutor at this exact position first.
    this.clearSubstitutorAtIndex(arrayKey, index, subIndex);

    // Resolve the referenced name to a root when possible. This ensures
    // that when a project is renamed and a new project takes the old name,
    // substitutors point at the correct root and are not triggered for the
    // wrong project.
    const referencedRoot = this.knownProjectNodes[referencedName]?.data?.root;
    const keyedByRoot = referencedRoot !== undefined;
    const mapKey = keyedByRoot ? referencedRoot : referencedName;
    const map = keyedByRoot
      ? this.substitutorsByReferencedRoot
      : this.substitutorsByUnresolvedName;

    let substitutorsForKey = map.get(mapKey);
    if (!substitutorsForKey) {
      substitutorsForKey = new Set();
      map.set(mapKey, substitutorsForKey);
    }

    const entry: SubstitutorEntry = { ownerRoot, substitutor };
    substitutorsForKey.add(entry);

    let byIndex = this.substitutorsByArrayKey.get(arrayKey);
    if (!byIndex) {
      byIndex = [];
      this.substitutorsByArrayKey.set(arrayKey, byIndex);
    }

    if (subIndex === undefined) {
      // Single project reference — store directly
      byIndex[index] = [{ mapKey, keyedByRoot, entry }];
    } else {
      // Multiple projects in an array — ensure the slot exists
      if (!byIndex[index]) {
        byIndex[index] = [];
      }
      const subArray = byIndex[index] as Array<
        | { mapKey: string; keyedByRoot: boolean; entry: SubstitutorEntry }
        | undefined
      >;
      subArray[subIndex] = { mapKey, keyedByRoot, entry };
    }
  }

  /**
   * Scans `pluginResultProjects` for `inputs` and `dependsOn` entries that
   * reference another project by name, and registers substitutors so those
   * references are updated if the target project is later renamed.
   *
   * Project nodes from each call are accumulated internally so that
   * string-form `dependsOn` entries (e.g. `"project:target"`) can be
   * properly parsed with {@link splitTargetFromNodes}, even when project
   * or target names contain colons.
   *
   * @param pluginResultProjects Projects from a single plugin's createNodes call.
   */
  registerSubstitutorsForNodeResults(
    pluginResultProjects?: Record<
      string,
      Omit<ProjectConfiguration, 'root'> & Partial<ProjectConfiguration>
    >
  ) {
    if (!pluginResultProjects) {
      return;
    }

    // Accumulate partial project graph nodes for splitTargetFromNodes.
    for (const root in pluginResultProjects) {
      const project = pluginResultProjects[root];
      const name = project.name;
      if (name) {
        this.knownProjectNodes[name] = {
          type: 'lib',
          name,
          data: { root, ...project } as ProjectConfiguration,
        };
      }
    }

    for (const ownerRoot in pluginResultProjects) {
      const project = pluginResultProjects[ownerRoot];
      if (!project.targets) {
        continue;
      }
      for (const targetName in project.targets) {
        const targetConfig = project.targets[targetName];
        if (!targetConfig || typeof targetConfig !== 'object') {
          continue;
        }
        if (Array.isArray(targetConfig.inputs)) {
          this.registerSubstitutorsForInputs(
            ownerRoot,
            targetName,
            targetConfig.inputs
          );
        }
        if (Array.isArray(targetConfig.dependsOn)) {
          this.registerSubstitutorsForDependsOn(
            ownerRoot,
            targetName,
            targetConfig.dependsOn,
            project.targets,
            project.name
          );
        }
      }
    }
  }

  // Factory methods for creating substitutors. Using factory functions
  // ensures that index variables (i, j) are captured as function parameters
  // (always by value), preventing closure-over-loop-variable bugs.

  private createInputsStringSubstitutor(
    targetName: string,
    i: number
  ): ProjectNameSubstitutor {
    return (finalName, ownerConfig) => {
      this.forEachTargetConfig(ownerConfig, targetName, (targetConfig) => {
        const finalInput = targetConfig.inputs?.[i];
        if (
          finalInput &&
          typeof finalInput === 'object' &&
          'projects' in finalInput
        ) {
          (finalInput as { projects: string }).projects = finalName;
        }
      });
    };
  }

  private createInputsArraySubstitutor(
    targetName: string,
    i: number,
    j: number
  ): ProjectNameSubstitutor {
    return (finalName, ownerConfig) => {
      this.forEachTargetConfig(ownerConfig, targetName, (targetConfig) => {
        const finalInput = targetConfig.inputs?.[i];
        if (
          finalInput &&
          typeof finalInput === 'object' &&
          'projects' in finalInput
        ) {
          (finalInput['projects'] as string[])[j] = finalName;
        }
      });
    };
  }

  private createDependsOnStringSubstitutor(
    targetName: string,
    i: number
  ): ProjectNameSubstitutor {
    return (finalName, ownerConfig) => {
      this.forEachTargetConfig(ownerConfig, targetName, (targetConfig) => {
        const finalDep = targetConfig.dependsOn?.[i];
        if (
          finalDep &&
          typeof finalDep === 'object' &&
          'projects' in finalDep
        ) {
          (finalDep as { projects: string }).projects = finalName;
        }
      });
    };
  }

  private createDependsOnArraySubstitutor(
    targetName: string,
    i: number,
    j: number
  ): ProjectNameSubstitutor {
    return (finalName, ownerConfig) => {
      this.forEachTargetConfig(ownerConfig, targetName, (targetConfig) => {
        const finalDep = targetConfig.dependsOn?.[i];
        if (
          finalDep &&
          typeof finalDep === 'object' &&
          'projects' in finalDep
        ) {
          (finalDep['projects'] as string[])[j] = finalName;
        }
      });
    };
  }

  private createDependsOnTargetStringSubstitutor(
    targetName: string,
    i: number,
    targetPart: string
  ): ProjectNameSubstitutor {
    return (finalName, ownerConfig) => {
      this.forEachTargetConfig(ownerConfig, targetName, (targetConfig) => {
        const finalDep = targetConfig.dependsOn?.[i];
        if (typeof finalDep === 'string') {
          (targetConfig.dependsOn as (string | object)[])[i] =
            `${finalName}:${targetPart}`;
        }
      });
    };
  }

  private registerSubstitutorsForInputs(
    ownerRoot: string,
    targetName: string,
    inputs: NonNullable<ProjectConfiguration['targets'][string]['inputs']>
  ) {
    const arrayKey = `${ownerRoot}:targets.${targetName}.inputs`;
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      if (typeof input !== 'object' || !('projects' in input)) {
        continue;
      }
      const inputProjectNames = input['projects'];
      if (typeof inputProjectNames === 'string') {
        // `self` and `dependencies` are keywords, not project names.
        if (
          inputProjectNames === 'self' ||
          inputProjectNames === 'dependencies'
        ) {
          continue;
        }
        this.registerProjectNameSubstitutor(
          inputProjectNames,
          ownerRoot,
          arrayKey,
          i,
          this.createInputsStringSubstitutor(targetName, i)
        );
      } else if (Array.isArray(inputProjectNames)) {
        for (let j = 0; j < inputProjectNames.length; j++) {
          const projectName = inputProjectNames[j];
          this.registerProjectNameSubstitutor(
            projectName,
            ownerRoot,
            arrayKey,
            i,
            this.createInputsArraySubstitutor(targetName, i, j),
            j // subIndex for array elements
          );
        }
        // Clear stale sub-indices if a later plugin shrinks the array.
        this.clearSubstitutorsFromSubIndex(
          arrayKey,
          i,
          inputProjectNames.length
        );
      }
    }
    // Evict any dangling substitutors at indices beyond the new array length —
    // the array may have shrunk compared to a previous plugin's contribution.
    this.clearSubstitutorsFromIndex(arrayKey, inputs.length);
  }

  private registerSubstitutorsForDependsOn(
    ownerRoot: string,
    targetName: string,
    dependsOn: NonNullable<
      ProjectConfiguration['targets'][string]['dependsOn']
    >,
    ownerTargets?: Record<string, unknown>,
    ownerProjectName?: string
  ) {
    const arrayKey = `${ownerRoot}:targets.${targetName}.dependsOn`;
    for (let i = 0; i < dependsOn.length; i++) {
      const dep = dependsOn[i];
      if (typeof dep === 'string') {
        // String-form dependsOn entries like "project:target". Strings
        // starting with '^' are dependency-mode references (no project
        // name). Use splitTargetFromNodes with accumulated project nodes
        // to properly handle project / target names containing colons.
        //
        // However, if the string matches a target name in the owning
        // project, it is a same-project target reference (e.g. a target
        // literally named "nx:echo"), not a cross-project reference.
        if (!dep.startsWith('^') && !(ownerTargets && dep in ownerTargets)) {
          const [maybeProject, ...rest] = splitTargetFromNodes(
            dep,
            this.knownProjectNodes,
            { silent: true, currentProject: ownerProjectName }
          );
          if (rest.length > 0) {
            const targetPart = rest.join(':');
            this.registerProjectNameSubstitutor(
              maybeProject,
              ownerRoot,
              arrayKey,
              i,
              this.createDependsOnTargetStringSubstitutor(
                targetName,
                i,
                targetPart
              )
            );
          }
        }
        continue;
      }
      if (typeof dep !== 'object' || !dep.projects) {
        continue;
      }
      const depProjects = dep.projects;
      if (typeof depProjects === 'string') {
        // `*`, `self`, and `dependencies` are keywords, not project names.
        if (['*', 'self', 'dependencies'].includes(depProjects)) {
          continue;
        }
        this.registerProjectNameSubstitutor(
          depProjects,
          ownerRoot,
          arrayKey,
          i,
          this.createDependsOnStringSubstitutor(targetName, i)
        );
      } else if (Array.isArray(depProjects)) {
        // Glob patterns can match multiple projects and can't be resolved
        // to a single project name at this stage, so we skip them.
        for (let j = 0; j < depProjects.length; j++) {
          const projectName = depProjects[j];
          if (isGlobPattern(projectName)) {
            continue;
          }
          this.registerProjectNameSubstitutor(
            projectName,
            ownerRoot,
            arrayKey,
            i,
            this.createDependsOnArraySubstitutor(targetName, i, j),
            j // subIndex for array elements
          );
        }
        // Clear stale sub-indices if a later plugin shrinks the array.
        this.clearSubstitutorsFromSubIndex(arrayKey, i, depProjects.length);
      }
    }
    // Evict any dangling substitutors at indices beyond the new array length —
    // the array may have shrunk compared to a previous plugin's contribution.
    this.clearSubstitutorsFromIndex(arrayKey, dependsOn.length);
  }

  /**
   * Records that the project at `root` was renamed from `previousName`.
   * Substitutors registered for `previousName` will fire during
   * {@link applySubstitutions}.
   */
  markDirty(root: string, previousName: string) {
    if (!this.dirtyEntries.has(root)) {
      this.dirtyEntries.set(root, new Set<string>());
    }
    // Only store the previous name when there are unresolved name-keyed
    // substitutors that actually need it. Root-keyed substitutors are
    // looked up by root directly and don't need the name at all.
    if (this.substitutorsByUnresolvedName.has(previousName)) {
      this.dirtyEntries.get(root).add(previousName);
    }
  }

  /**
   * Executes all registered substitutors for renamed projects, updating
   * stale project name references in the final merged `rootMap`. Should be
   * called once after all plugin results have been merged.
   */
  applySubstitutions(rootMap: Record<string, ProjectConfiguration>) {
    for (const [root, previousNames] of this.dirtyEntries) {
      const finalName = rootMap[root]?.name;
      if (!finalName) {
        continue;
      }

      // Primary lookup: substitutors keyed by the root of the renamed
      // project. These were resolved at registration time.
      const rootSubstitutors = this.substitutorsByReferencedRoot.get(root);
      if (rootSubstitutors) {
        for (const { ownerRoot, substitutor } of rootSubstitutors) {
          const ownerConfig = rootMap[ownerRoot];
          if (ownerConfig) {
            substitutor(finalName, ownerConfig);
          }
        }
      }

      // Fallback: substitutors keyed by name (for forward references whose
      // root could not be resolved at registration time).
      for (const previousName of previousNames) {
        const nameSubstitutors =
          this.substitutorsByUnresolvedName.get(previousName);
        if (!nameSubstitutors) {
          continue;
        }
        for (const { ownerRoot, substitutor } of nameSubstitutors) {
          const ownerConfig = rootMap[ownerRoot];
          if (ownerConfig) {
            substitutor(finalName, ownerConfig);
          }
        }
      }
    }
  }
}
