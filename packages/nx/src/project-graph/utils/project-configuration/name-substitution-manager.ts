import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { isGlobPattern } from '../../../utils/globs';
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
  // Maps the *referenced project name at registration time* → set of
  // substitutor entries that should run when a project is renamed FROM
  // that name. Keying by name (not root) means no project-map lookup is
  // needed at registration time, and ordering between result entries does
  // not matter.
  private projectNameSubstitutors = new Map<string, Set<SubstitutorEntry>>();

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
      | Array<{ referencedName: string; entry: SubstitutorEntry } | undefined>
      | undefined
    >
  >();

  // Projects whose names changed during the merge phase. Key = root of the
  // renamed project, value = all names it previously held in this merge.
  // These are used in applySubstitutions to locate substitutors keyed by
  // old names.
  private dirtyEntries = new Map<string, Set<string>>();

  private removeSubstitutorEntry(item: {
    referencedName: string;
    entry: SubstitutorEntry;
  }) {
    const substitutors = this.projectNameSubstitutors.get(item.referencedName);
    if (!substitutors) {
      return;
    }
    substitutors.delete(item.entry);
    if (substitutors.size === 0) {
      this.projectNameSubstitutors.delete(item.referencedName);
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

  // Registers a new substitutor keyed by `referencedName` (the project name
  // as it appears in the reference), tracked at (arrayKey, index, subIndex)
  // for deduplication and tail-clearing.
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

    let substitutorsForName = this.projectNameSubstitutors.get(referencedName);
    if (!substitutorsForName) {
      substitutorsForName = new Set();
      this.projectNameSubstitutors.set(referencedName, substitutorsForName);
    }

    const entry: SubstitutorEntry = { ownerRoot, substitutor };
    substitutorsForName.add(entry);

    let byIndex = this.substitutorsByArrayKey.get(arrayKey);
    if (!byIndex) {
      byIndex = [];
      this.substitutorsByArrayKey.set(arrayKey, byIndex);
    }

    if (subIndex === undefined) {
      // Single project reference — store directly
      byIndex[index] = [{ referencedName, entry }];
    } else {
      // Multiple projects in an array — ensure the slot exists
      if (!byIndex[index]) {
        byIndex[index] = [];
      }
      const subArray = byIndex[index] as Array<
        { referencedName: string; entry: SubstitutorEntry } | undefined
      >;
      subArray[subIndex] = { referencedName, entry };
    }
  }

  /**
   * Scans `pluginResultProjects` for `inputs` and `dependsOn` entries that
   * reference another project by name, and registers substitutors so those
   * references are updated if the target project is later renamed.
   *
   * No lookup into any project map is performed — substitutors are simply
   * keyed by whatever name appears in the reference. This means registration
   * is safe to call at any point during the merge, regardless of whether the
   * referenced project has been processed yet.
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
            targetConfig.dependsOn
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
    dependsOn: NonNullable<ProjectConfiguration['targets'][string]['dependsOn']>
  ) {
    const arrayKey = `${ownerRoot}:targets.${targetName}.dependsOn`;
    for (let i = 0; i < dependsOn.length; i++) {
      const dep = dependsOn[i];
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
    let previousNames = this.dirtyEntries.get(root);
    if (!previousNames) {
      previousNames = new Set<string>();
      this.dirtyEntries.set(root, previousNames);
    }
    previousNames.add(previousName);
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
      for (const previousName of previousNames) {
        const substitutors = this.projectNameSubstitutors.get(previousName);
        if (!substitutors) {
          continue;
        }
        for (const { ownerRoot, substitutor } of substitutors) {
          // Each entry stores the ownerRoot of the project holding the stale
          // reference so we can look up its final merged config here.
          const ownerConfig = rootMap[ownerRoot];
          if (ownerConfig) {
            substitutor(finalName, ownerConfig);
          }
        }
      }
    }
  }
}
