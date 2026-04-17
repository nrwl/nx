import { ProjectConfiguration } from '../../../config/workspace-json-project-json';
import { isGlobPattern } from '../../../utils/globs';
import { splitTargetFromConfigurations } from '../../../utils/split-target';

/**
 * Inline sentinel placed in `inputs` / `dependsOn` slots to represent a
 * pending project-name reference.
 *
 * - {@link RootRef} carries the *root* of the referenced project. The
 *   final pass resolves it by looking up the current name at that root.
 * - {@link UsageRef} carries the *name as written* by the plugin. It
 *   exists when the referenced project wasn't in the nameMap at
 *   registration time (forward reference). When the name is later
 *   identified, the sentinel's prototype is swapped to {@link RootRef}
 *   in place — because spread-merges share object identity, a single
 *   mutation updates every copy.
 *
 * `parent` is a back-reference to the immediate container holding the
 * sentinel: either the wrapping input/dependsOn element object (key
 * form) or the inner projects array (array form). For object parents,
 * `key` identifies the slot; for array parents, the slot is found by
 * identity walking the array.
 *
 * `targetPart` is only set for dependsOn string-form entries
 * (`proj:target`) so the final pass can reconstruct the `name:target`
 * string.
 */
export abstract class NameRef {
  constructor(
    public value: string,
    public parent: unknown,
    public key: string | undefined,
    public targetPart: string | undefined
  ) {}
}

export class RootRef extends NameRef {}
export class UsageRef extends NameRef {}

export function isNameRef(value: unknown): value is NameRef {
  return value instanceof NameRef;
}

export function isRootRef(value: unknown): value is RootRef {
  return value instanceof RootRef;
}

export function isUsageRef(value: unknown): value is UsageRef {
  return value instanceof UsageRef;
}

/**
 * Replaces project-name references in plugin results with inline sentinel
 * objects during the merge phase, then resolves them to final names in a
 * single pass after all merging is done.
 *
 * ### Why this exists
 *
 * When plugins return `createNodes` results, one project may reference
 * another by name in `inputs` or `dependsOn`. A *later* plugin is allowed
 * to rename the referenced project, which would leave the original
 * reference stale.
 *
 * Rather than tracking references by array position (which is fragile
 * once `...` spread tokens are in play) this manager replaces each
 * reference in place with a sentinel object. Because arrays get
 * spread-merged by pushing element *references*, the sentinel objects
 * retain identity through any downstream merges. A flat registry holds
 * every sentinel, and the final pass walks the registry, writing the
 * current name back through each sentinel's parent back-reference.
 *
 * Orphaned sentinels (from plugin results whose arrays were discarded
 * by a later full-replace merge) still appear in the registry; the
 * final pass writes into the discarded arrays harmlessly, and the
 * whole registry is dropped at the end of {@link applySubstitutions}.
 */
export class ProjectNameInNodePropsManager {
  private getNameMap: () => Record<string, ProjectConfiguration>;
  private allRefs = new Set<RootRef | UsageRef>();
  private pendingByName = new Map<string, Set<RootRef | UsageRef>>();

  constructor(getNameMap?: () => Record<string, ProjectConfiguration>) {
    this.getNameMap = getNameMap ?? (() => ({}));
  }

  /**
   * Walks the plugin result's projects and replaces every project-name
   * reference in `inputs` / `dependsOn` with a sentinel object in place.
   *
   * Must be called after all projects in the plugin result have been
   * identified (via {@link identifyProjectWithRoot}) so that same-batch
   * forward references can resolve eagerly to root refs.
   */
  registerNameRefs(
    pluginResultProjects?: Record<
      string,
      Omit<ProjectConfiguration, 'root'> & Partial<ProjectConfiguration>
    >
  ): void {
    if (!pluginResultProjects) return;

    for (const ownerRoot in pluginResultProjects) {
      const project = pluginResultProjects[ownerRoot];
      if (!project?.targets) continue;

      for (const targetName in project.targets) {
        const targetConfig = project.targets[targetName];
        if (!targetConfig || typeof targetConfig !== 'object') continue;

        if (Array.isArray(targetConfig.inputs)) {
          this.processInputs(targetConfig.inputs as unknown[]);
        }
        if (Array.isArray(targetConfig.dependsOn)) {
          this.processDependsOn(
            targetConfig.dependsOn as unknown[],
            project.targets as Record<string, unknown>,
            project.name
          );
        }
      }
    }
  }

  private processInputs(inputs: unknown[]): void {
    for (let i = 0; i < inputs.length; i++) {
      const entry = inputs[i];
      // If the entry itself is a sentinel (array-parent form from a
      // previously-processed dependsOn-style slot being reused), rebind
      // its parent to the current array — a prior spread merge may have
      // copied it out of the array it was originally inserted into.
      if (isNameRef(entry)) {
        entry.parent = inputs;
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;
      if (!('projects' in entry)) continue;
      const element = entry as { projects: unknown };
      const projects = element.projects;

      if (isNameRef(projects)) {
        // Object-parent sentinel: element object identity is stable
        // across spread, but the parent back-ref still points at the
        // element — nothing to rebind.
        continue;
      }
      if (typeof projects === 'string') {
        if (projects === 'self' || projects === 'dependencies') continue;
        element.projects = this.createRef(projects, element, 'projects');
      } else if (Array.isArray(projects)) {
        this.processProjectsArray(projects);
      }
    }
  }

  private processDependsOn(
    dependsOn: unknown[],
    ownerTargets: Record<string, unknown> | undefined,
    ownerName: string | undefined
  ): void {
    for (let i = 0; i < dependsOn.length; i++) {
      const dep = dependsOn[i];
      // Existing sentinel in the dependsOn array — rebind its parent to
      // the current array in case spread-merge copied it out of the
      // original. Both the array-parent form (string-form depsOn) and a
      // stray wrapper would benefit; object-parent sentinels nested
      // inside `{projects: ...}` wrappers are handled below.
      if (isNameRef(dep)) {
        dep.parent = dependsOn;
        continue;
      }

      if (typeof dep === 'string') {
        // Dependency-mode refs (^target) and same-project target names
        // aren't cross-project references.
        if (dep.startsWith('^') || (ownerTargets && dep in ownerTargets)) {
          continue;
        }
        const [maybeProject, ...rest] = splitTargetFromConfigurations(
          dep,
          this.getNameMap(),
          { silent: true, currentProject: ownerName }
        );
        if (rest.length === 0) continue;
        const targetPart = rest.join(':');
        dependsOn[i] = this.createRef(
          maybeProject,
          dependsOn,
          undefined,
          targetPart
        );
        continue;
      }

      if (!dep || typeof dep !== 'object' || !('projects' in dep)) continue;
      const element = dep as { projects: unknown };
      const projects = element.projects;

      if (isNameRef(projects)) {
        // Object-parent sentinel — element object is stable, nothing to
        // rebind.
        continue;
      }
      if (typeof projects === 'string') {
        if (
          projects === '*' ||
          projects === 'self' ||
          projects === 'dependencies'
        ) {
          continue;
        }
        element.projects = this.createRef(projects, element, 'projects');
      } else if (Array.isArray(projects)) {
        this.processProjectsArray(projects);
      }
    }
  }

  private processProjectsArray(projects: unknown[]): void {
    for (let j = 0; j < projects.length; j++) {
      const name = projects[j];
      if (isNameRef(name)) {
        // Rebind in case a spread merge pulled the projects array
        // itself (rare, since projects arrays live inside element
        // objects — but cheap to be defensive).
        name.parent = projects;
        continue;
      }
      if (typeof name !== 'string') continue;
      if (isGlobPattern(name)) continue;
      projects[j] = this.createRef(name, projects, undefined);
    }
  }

  /**
   * Builds a sentinel, records it in the flat registry (and in
   * `pendingByName` if the name isn't yet known), and returns it so the
   * caller can drop it into the owning slot.
   */
  private createRef(
    referencedName: string,
    parent: unknown,
    key: string | undefined,
    targetPart?: string
  ): RootRef | UsageRef {
    const referencedRoot = this.getNameMap()[referencedName]?.root;
    const ref: RootRef | UsageRef =
      referencedRoot !== undefined
        ? new RootRef(referencedRoot, parent, key, targetPart)
        : new UsageRef(referencedName, parent, key, targetPart);

    this.allRefs.add(ref);

    if (ref instanceof UsageRef) {
      let set = this.pendingByName.get(referencedName);
      if (!set) {
        set = new Set();
        this.pendingByName.set(referencedName, set);
      }
      set.add(ref);
    }

    return ref;
  }

  /**
   * Records that a project with `name` now lives at `root`. Promotes any
   * waiting {@link UsageRef} sentinels to {@link RootRef} by swapping
   * their prototype in place — object identity across spread-copies
   * means one promotion updates every array the sentinel reached.
   *
   * Called by {@link ProjectNodesManager} whenever a project name
   * changes at a root (first identification or rename).
   */
  identifyProjectWithRoot(root: string, name: string): void {
    const pending = this.pendingByName.get(name);
    if (!pending) return;
    this.pendingByName.delete(name);

    for (const ref of pending) {
      if (!(ref instanceof UsageRef)) continue;
      Object.setPrototypeOf(ref, RootRef.prototype);
      ref.value = root;
    }
  }

  /**
   * Walks every registered sentinel and writes the current name of its
   * referenced project back into the owning slot. Object-parent refs are
   * resolved by key; array-parent refs are resolved by identity via
   * `indexOf`. Called once after all plugin results have been merged.
   */
  applySubstitutions(rootMap: Record<string, ProjectConfiguration>): void {
    const nameByRoot: Record<string, string | undefined> = {};
    for (const root in rootMap) {
      nameByRoot[root] = rootMap[root]?.name;
    }

    for (const ref of this.allRefs) {
      const finalName = this.resolveFinalName(ref, nameByRoot);
      if (finalName === undefined) {
        // Can't resolve (orphaned root ref or unknown usage ref): leave
        // the owning slot alone.
        continue;
      }

      const replacement =
        ref.targetPart !== undefined
          ? `${finalName}:${ref.targetPart}`
          : finalName;

      this.writeReplacement(ref, replacement);
    }

    this.allRefs.clear();
    this.pendingByName.clear();
  }

  private resolveFinalName(
    ref: RootRef | UsageRef,
    nameByRoot: Record<string, string | undefined>
  ): string | undefined {
    if (ref instanceof RootRef) {
      return nameByRoot[ref.value];
    }
    // Unpromoted forward reference — best-effort name lookup, then fall
    // back to the literal name written by the plugin.
    return this.getNameMap()[ref.value]?.name ?? ref.value;
  }

  private writeReplacement(ref: NameRef, replacement: string): void {
    const parent = ref.parent;
    if (Array.isArray(parent)) {
      // A single sentinel object may occupy multiple slots in the same
      // array — `getMergeValueResult` pushes element references, so if
      // a later plugin contributes `[..., ...]` each spread token pushes
      // the base array's elements again and the sentinel ends up at
      // every copied index. Walk the whole array and replace every
      // identity-equal occurrence, not just the first one found by
      // `indexOf`.
      for (let i = 0; i < parent.length; i++) {
        if (parent[i] === ref) parent[i] = replacement;
      }
      return;
    }
    if (parent && typeof parent === 'object' && ref.key !== undefined) {
      (parent as Record<string, unknown>)[ref.key] = replacement;
    }
  }
}
