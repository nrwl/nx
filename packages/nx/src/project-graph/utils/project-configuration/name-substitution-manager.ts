import {
  InputDefinition,
  ProjectConfiguration,
  TargetConfiguration,
  TargetDependencyConfig,
} from '../../../config/workspace-json-project-json';
import { isGlobPattern } from '../../../utils/globs';
import { splitTargetFromConfigurations } from '../../../utils/split-target';

type InputEntry = string | InputDefinition | NameRef;
type DependsOnEntry = string | TargetDependencyConfig | NameRef;
type ProjectsEntry = string | NameRef;

/**
 * Sentinel placed in `inputs` / `dependsOn` for a pending project-name
 * reference. `RootRef` carries the referenced project's root (resolved
 * via nameMap lookup); `UsageRef` carries the raw written name (for
 * forward refs, promoted to `RootRef` in place when the name is
 * identified). `parent` + `key` let the final pass write the resolved
 * name back; `targetPart` preserves the `:target` suffix from
 * `dependsOn` strings.
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
 * Replaces project-name refs in plugin results with in-place sentinels,
 * then resolves them after all merging is done.
 *
 * Tracking by array position breaks once `'...'` spreads shuffle indices,
 * so each ref becomes a sentinel object. Arrays spread-merge by pushing
 * element references, so sentinel identity survives any downstream
 * merges — the final pass walks a flat registry and writes the resolved
 * name back through each sentinel's `parent` back-reference. Orphaned
 * sentinels (from arrays dropped by a full-replace) write harmlessly.
 */
export class ProjectNameInNodePropsManager {
  private getNameMap: () => Record<string, ProjectConfiguration>;
  private allRefs = new Set<RootRef | UsageRef>();
  private pendingByName = new Map<string, Set<RootRef | UsageRef>>();

  constructor(getNameMap?: () => Record<string, ProjectConfiguration>) {
    this.getNameMap = getNameMap ?? (() => ({}));
  }

  // Replaces each project-name ref in `inputs`/`dependsOn` with a sentinel.
  // Call after `identifyProjectWithRoot` for the batch so same-batch forward
  // refs resolve straight to RootRefs.
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
          this.processInputs(targetConfig.inputs);
        }
        if (Array.isArray(targetConfig.dependsOn)) {
          this.processDependsOn(
            targetConfig.dependsOn,
            project.targets,
            project.name
          );
        }
      }
    }
  }

  private processInputs(inputs: InputEntry[]): void {
    for (let i = 0; i < inputs.length; i++) {
      const entry = inputs[i];
      // Existing sentinel: spread merges may have copied it out of its
      // original array, so rebind parent to this one.
      if (isNameRef(entry)) {
        entry.parent = inputs;
        continue;
      }
      if (!entry || typeof entry !== 'object') continue;
      if (!('projects' in entry)) continue;
      const element = entry as { projects: unknown };
      const projects = element.projects;

      if (isNameRef(projects)) {
        // Object-parent sentinel — element identity is stable across spread.
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
    dependsOn: DependsOnEntry[],
    ownerTargets: Record<string, TargetConfiguration> | undefined,
    ownerName: string | undefined
  ): void {
    for (let i = 0; i < dependsOn.length; i++) {
      const dep = dependsOn[i];
      // Existing sentinel: rebind parent to this array in case a spread
      // merge copied it out of its original.
      if (isNameRef(dep)) {
        dep.parent = dependsOn;
        continue;
      }

      if (typeof dep === 'string') {
        // `^target` and same-project targets aren't cross-project refs.
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

  private processProjectsArray(projects: ProjectsEntry[]): void {
    for (let j = 0; j < projects.length; j++) {
      const name = projects[j];
      if (isNameRef(name)) {
        name.parent = projects;
        continue;
      }
      if (typeof name !== 'string') continue;
      if (isGlobPattern(name)) continue;
      projects[j] = this.createRef(name, projects, undefined);
    }
  }

  // Builds a sentinel and registers it.
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

  // Records `name` → `root` and promotes any waiting UsageRef sentinels to
  // RootRef by prototype swap. Sentinel identity across spread copies means
  // one promotion updates every array the sentinel reached.
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

  // Writes each sentinel's current resolved name back into its owning slot.
  // Called once after all plugin results have been merged.
  applySubstitutions(rootMap: Record<string, ProjectConfiguration>): void {
    const nameByRoot: Record<string, string | undefined> = {};
    for (const root in rootMap) {
      nameByRoot[root] = rootMap[root]?.name;
    }

    for (const ref of this.allRefs) {
      const finalName = this.resolveFinalName(ref, nameByRoot);
      if (finalName === undefined) continue;

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
    // Unpromoted forward ref — best effort, fall back to the written name.
    return this.getNameMap()[ref.value]?.name ?? ref.value;
  }

  private writeReplacement(ref: NameRef, replacement: string): void {
    const parent = ref.parent;
    if (Array.isArray(parent)) {
      // One sentinel may appear at multiple indices (e.g. `[..., ...]`
      // pushed the same reference twice via spread), so replace all.
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
