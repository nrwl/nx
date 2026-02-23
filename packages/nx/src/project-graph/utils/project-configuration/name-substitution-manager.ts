import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { isGlobPattern } from '../../../utils/globs';

// A substitutor receives the final resolved name of the project whose root
// was marked dirty (i.e. the project that was renamed), and the final merged
// configuration of the project that *holds the stale reference* so it can
// update the appropriate field in-place.
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
 * 2. Recording a "substitutor" closure for each such reference, keyed by
 *    the root directory of the referenced project.
 * 3. When a project's name changes during the merge, marking that root as
 *    dirty ({@link markDirty}).
 * 4. After all results are merged, applying the substitutors for every
 *    dirty root so that references are updated to the final name
 *    ({@link applySubstitutions}).
 */
export class ProjectNameInNodePropsManager {
  // Maps root directory -> set of substitutor entries that should run when
  // the project at that root is renamed. Using a Set allows O(1) removal
  // when a source-map key is overwritten by a later plugin registration.
  private projectNameSubstitutors = new Map<string, Set<SubstitutorEntry>>();

  // Tracks substitutor entries by (array path, index, subIndex). This serves two purposes:
  //
  // 1. Per-index deduplication: if the same array index is registered again
  //    (e.g. two plugin results contribute to the same position), the old
  //    substitutor is evicted before the new one is added.
  //
  // 2. Tail-clearing: when a later plugin provides a shorter array at the
  //    same path, splice removes all tail entries in one call without
  //    needing to iterate from fromIndex to the end.
  //
  // Outer key: array path (e.g. "targets.build.inputs")
  // Inner array: indexed by position; each position is itself an array to handle
  //   multiple project names within a single projects array (e.g., ['project-b', 'project-c']).
  private substitutorsByArrayKey = new Map<
    string,
    Array<
      | Array<{ referencedRoot: string; entry: SubstitutorEntry } | undefined>
      | undefined
    >
  >();

  // Roots whose project name changed during the merge phase. Only these
  // roots need their substitutors executed in applySubstitutions.
  private dirtyRoots = new Set<string>();

  // Removes the substitutor registered at the given index (and optional subIndex) of an array, if any.
  // Used when re-registering for the same index (same position overwritten by
  // a later plugin).
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
      if (Array.isArray(atIndex)) {
        // It's an array of substitutors, clear all
        for (const item of atIndex) {
          if (item) {
            this.projectNameSubstitutors
              .get(item.referencedRoot)
              ?.delete(item.entry);
          }
        }
      }
      byIndex[index] = undefined;
    } else {
      // Clear only the specific subIndex (within a projects array)
      if (Array.isArray(atIndex)) {
        const existing = atIndex[subIndex];
        if (existing) {
          this.projectNameSubstitutors
            .get(existing.referencedRoot)
            ?.delete(existing.entry);
          atIndex[subIndex] = undefined;
        }
      }
    }
  }

  // Removes all substitutors at indices >= `fromIndex` for the given array
  // path. Uses splice so the tail is dropped in one operation rather than
  // iterating over each index individually.
  private clearSubstitutorsFromIndex(arrayKey: string, fromIndex: number) {
    const byIndex = this.substitutorsByArrayKey.get(arrayKey);
    if (!byIndex) {
      return;
    }
    const removed = byIndex.splice(fromIndex);
    for (const atIndex of removed) {
      if (atIndex) {
        if (Array.isArray(atIndex)) {
          // It's an array of substitutors (for projects arrays)
          for (const item of atIndex) {
            if (item) {
              this.projectNameSubstitutors
                .get(item.referencedRoot)
                ?.delete(item.entry);
            }
          }
        }
      }
    }
  }

  // Registers a new substitutor for the project at `referencedRoot`, tracked
  // at (arrayKey, index, subIndex) so it can be individually replaced or bulk-evicted
  // when the array shrinks.
  private registerProjectNameSubstitutor(
    referencedRoot: string,
    ownerRoot: string,
    arrayKey: string,
    index: number,
    substitutor: ProjectNameSubstitutor,
    subIndex?: number
  ) {
    // Evict any existing substitutor at this exact position first.
    this.clearSubstitutorAtIndex(arrayKey, index, subIndex);

    let substitutorsForRoot = this.projectNameSubstitutors.get(referencedRoot);
    if (!substitutorsForRoot) {
      substitutorsForRoot = new Set();
      this.projectNameSubstitutors.set(referencedRoot, substitutorsForRoot);
    }

    const entry: SubstitutorEntry = { ownerRoot, substitutor };
    substitutorsForRoot.add(entry);

    let byIndex = this.substitutorsByArrayKey.get(arrayKey);
    if (!byIndex) {
      byIndex = [];
      this.substitutorsByArrayKey.set(arrayKey, byIndex);
    }

    if (subIndex === undefined) {
      // Single project reference - store directly
      byIndex[index] = [{ referencedRoot, entry }];
    } else {
      // Multiple projects in an array - ensure the array exists and store at subIndex
      if (!byIndex[index]) {
        byIndex[index] = [];
      }
      const subArray = byIndex[index] as Array<
        { referencedRoot: string; entry: SubstitutorEntry } | undefined
      >;
      subArray[subIndex] = { referencedRoot, entry };
    }
  }

  /**
   * Scans `pluginResultProjects` for `inputs` and `dependsOn` entries that
   * reference another project by name, and registers substitutors so those
   * references are updated if the target project is later renamed.
   *
   * ### Performance notes
   * - Iterates every target in every project result from the current plugin.
   * - Builds a lazy name→project lookup of `mergedRootMap` only if an
   *   inter-plugin reference is found (avoids the cost when unnecessary).
   * - The actual substitutions are deferred until {@link applySubstitutions}.
   *
   * @param pluginResultProjects Projects from a single plugin's createNodes call.
   * @param mergedRootMap The accumulated root map from all prior plugin results.
   */
  registerSubstitutorsForNodeResults(
    pluginResultProjects?: Record<
      string,
      Omit<ProjectConfiguration, 'root'> & Partial<ProjectConfiguration>
    >,
    mergedRootMap?: Record<string, ProjectConfiguration>
  ) {
    if (!pluginResultProjects) {
      return;
    }

    // nameMap first checks the current plugin's own results (fast path for
    // intra-plugin references), then falls back to the previously-merged
    // results from earlier plugins (lazy to avoid unnecessary computation).
    const nameMap = new AggregateMap(
      rootMapToNameMap(pluginResultProjects),
      // to be clear, we use this so that if the current plugin
      // only references projects that are defined by iteself,
      // we don't need to build the name map for the merged root map at all
      new LazyMap(() => rootMapToNameMap(mergedRootMap))
    );

    for (const ownerRoot in pluginResultProjects) {
      const project = pluginResultProjects[ownerRoot];
      if (!project.targets) {
        continue;
      }
      for (const targetName in project.targets) {
        const targetConfig = project.targets[targetName];
        if (targetConfig.inputs) {
          this.registerSubstitutorsForInputs(
            ownerRoot,
            targetName,
            targetConfig.inputs,
            nameMap
          );
        }
        if (targetConfig.dependsOn) {
          this.registerSubstitutorsForDependsOn(
            ownerRoot,
            targetName,
            targetConfig.dependsOn,
            nameMap
          );
        }
      }
    }
  }

  // Registers substitutors for any project-name references found inside a
  // target's `inputs` array. Substitutors are registered against the root of
  // the *referenced* project, so they fire when that project is renamed.
  // The substitutor closes over `ownerRoot` and the array index so it can
  // navigate to the correct property in the final merged config.
  // Factory methods for creating substitutors. Using factory functions instead
  // of inline closures ensures that index variables (i, j) are captured as
  // function parameters (always by value), preventing classic closure-over-
  // loop-variable bugs where a shared `let` binding is mutated after the
  // closure is created.

  private createInputsStringSubstitutor(
    targetName: string,
    i: number
  ): ProjectNameSubstitutor {
    return (finalName, ownerConfig) => {
      const finalInput = ownerConfig.targets?.[targetName]?.inputs?.[i];
      if (
        finalInput &&
        typeof finalInput === 'object' &&
        'projects' in finalInput
      ) {
        (finalInput as { projects: string }).projects = finalName;
      }
    };
  }

  private createInputsArraySubstitutor(
    targetName: string,
    i: number,
    j: number
  ): ProjectNameSubstitutor {
    return (finalName, ownerConfig) => {
      const finalInput = ownerConfig.targets?.[targetName]?.inputs?.[i];
      if (
        finalInput &&
        typeof finalInput === 'object' &&
        'projects' in finalInput
      ) {
        (finalInput['projects'] as string[])[j] = finalName;
      }
    };
  }

  private createDependsOnStringSubstitutor(
    targetName: string,
    i: number
  ): ProjectNameSubstitutor {
    return (finalName, ownerConfig) => {
      const finalDep = ownerConfig.targets?.[targetName]?.dependsOn?.[i];
      if (finalDep && typeof finalDep === 'object' && 'projects' in finalDep) {
        (finalDep as { projects: string }).projects = finalName;
      }
    };
  }

  private createDependsOnArraySubstitutor(
    targetName: string,
    i: number,
    j: number
  ): ProjectNameSubstitutor {
    return (finalName, ownerConfig) => {
      const finalDep = ownerConfig.targets?.[targetName]?.dependsOn?.[i];
      if (finalDep && typeof finalDep === 'object' && 'projects' in finalDep) {
        (finalDep['projects'] as string[])[j] = finalName;
      }
    };
  }

  private registerSubstitutorsForInputs(
    ownerRoot: string,
    targetName: string,
    inputs: NonNullable<ProjectConfiguration['targets'][string]['inputs']>,
    nameMap: AggregateMap<string, ProjectConfiguration>
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
        const referencedProject = nameMap.get(inputProjectNames);
        if (referencedProject) {
          this.registerProjectNameSubstitutor(
            referencedProject.root,
            ownerRoot,
            arrayKey,
            i,
            this.createInputsStringSubstitutor(targetName, i)
          );
        }
      } else if (Array.isArray(inputProjectNames)) {
        for (let j = 0; j < inputProjectNames.length; j++) {
          const projectName = inputProjectNames[j];
          const referencedProject = nameMap.get(projectName);
          if (referencedProject) {
            this.registerProjectNameSubstitutor(
              referencedProject.root,
              ownerRoot,
              arrayKey,
              i,
              this.createInputsArraySubstitutor(targetName, i, j),
              j // Pass subIndex for array elements
            );
          }
        }
      }
    }
    // Evict any dangling substitutors at indices beyond the new array length —
    // the array may have shrunk compared to a previous plugin's contribution.
    this.clearSubstitutorsFromIndex(arrayKey, inputs.length);
  }

  // Registers substitutors for any project-name references found inside a
  // target's `dependsOn` array. Substitutors are registered against the root
  // of the *referenced* project, so they fire when that project is renamed.
  // The substitutor closes over `ownerRoot` and the array index so it can
  // navigate to the correct property in the final merged config.
  private registerSubstitutorsForDependsOn(
    ownerRoot: string,
    targetName: string,
    dependsOn: NonNullable<
      ProjectConfiguration['targets'][string]['dependsOn']
    >,
    nameMap: AggregateMap<string, ProjectConfiguration>
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
        const referencedProject = nameMap.get(depProjects);
        if (referencedProject) {
          this.registerProjectNameSubstitutor(
            referencedProject.root,
            ownerRoot,
            arrayKey,
            i,
            this.createDependsOnStringSubstitutor(targetName, i)
          );
        }
      } else if (Array.isArray(depProjects)) {
        // Glob patterns can match multiple projects and can't be resolved
        // to a single root at this stage, so we skip them.
        for (let j = 0; j < depProjects.length; j++) {
          const projectName = depProjects[j];
          if (isGlobPattern(projectName)) {
            continue;
          }
          const referencedProject = nameMap.get(projectName);
          if (referencedProject) {
            this.registerProjectNameSubstitutor(
              referencedProject.root,
              ownerRoot,
              arrayKey,
              i,
              this.createDependsOnArraySubstitutor(targetName, i, j),
              j // Pass subIndex for array elements
            );
          }
        }
      }
    }
    // Evict any dangling substitutors at indices beyond the new array length —
    // the array may have shrunk compared to a previous plugin's contribution.
    this.clearSubstitutorsFromIndex(arrayKey, dependsOn.length);
  }

  /**
   * Marks the project at `root` as having had its name changed. This causes
   * all substitutors registered for that root to execute during
   * {@link applySubstitutions}.
   */
  markDirty(root: string) {
    this.dirtyRoots.add(root);
  }

  /**
   * Executes all registered substitutors for dirty roots, updating stale
   * project name references in the final merged `rootMap`. Should be called
   * once after all plugin results have been merged.
   */
  applySubstitutions(rootMap: Record<string, ProjectConfiguration>) {
    for (const root of this.dirtyRoots) {
      const substitutors = this.projectNameSubstitutors.get(root);
      if (!substitutors) {
        continue;
      }
      const finalName = rootMap[root]?.name;
      if (!finalName) {
        continue;
      }
      for (const { ownerRoot, substitutor } of substitutors) {
        // Each entry stores the ownerRoot of the project holding the stale
        // reference so we can look up its final merged config here, without
        // passing the full rootMap into every substitutor.
        const ownerConfig = rootMap[ownerRoot];
        if (ownerConfig) {
          substitutor(finalName, ownerConfig);
        }
      }
    }
  }
}

function rootMapToNameMap(
  rm:
    | Record<
        string,
        Omit<ProjectConfiguration, 'root'> & Partial<ProjectConfiguration>
      >
    | undefined
): Map<string, ProjectConfiguration> {
  const map = new Map<string, ProjectConfiguration>();
  if (!rm) {
    return map;
  }
  for (const root in rm) {
    const project = rm[root];
    if (project.name) {
      project.root ??= root;
      map.set(project.name, project as ProjectConfiguration);
    }
  }
  return map;
}

class LazyMap<K, V> {
  private data?: Map<K, V>;

  constructor(private builder: () => Map<K, V>) {}

  get(key: K): V | undefined {
    if (!this.data) {
      this.data = this.builder();
    }
    return this.data.get(key);
  }
}

class AggregateMap<K, V> {
  private readonly maps: Array<Map<K, V> | LazyMap<K, V>>;
  constructor(...maps: Array<Map<K, V> | LazyMap<K, V>>) {
    this.maps = maps;
  }

  get(key: K) {
    for (const map of this.maps) {
      const v = map.get(key);
      if (v !== undefined) {
        return v;
      }
    }
  }
}
