/**
 * Why something was considered affected.
 *
 * One open shape rather than a discriminated union, because these cross the napi
 * boundary as `#[napi(object)]` structs and napi objects carry no tag. `kind`
 * is the discriminant; the rest are populated per kind and absent otherwise. A
 * locator that cannot attribute a single cause leaves the payload empty rather
 * than inventing one.
 *
 * Reasons are collected flat: an entity lists every reason that applies to it,
 * and propagation is expressed by naming the producer rather than nesting its
 * reasons. `nx affected --explain` prints every entity, so the producer's own
 * reasons are one lookup away in the same output.
 */
export type AffectedReasonKind =
  /** A changed file the project owns, by root. */
  | 'project-file'
  /** A `{workspaceRoot}` fileset a target declares as an input. */
  | 'implicit-dependency'
  /** `nx.json` changed, which can restructure the task graph. */
  | 'workspace-configuration'
  /** A project config no longer on disk, so its project is gone. */
  | 'deleted-project-configuration'
  /** Task-level: a project config the task hashes changed. */
  | 'project-configuration'
  /** A lockfile changed. */
  | 'lockfile'
  /** An external package's version moved. */
  | 'npm-package'
  /** The root tsconfig changed in a way that can reach every project. */
  | 'tsconfig'
  /** A path mapping into the project changed in the root tsconfig. */
  | 'tsconfig-paths'
  /** Project-level only: it depends on a project that is affected. */
  | 'dependency'
  /** Task-level: a changed file matched one of the task's inputs. */
  | 'input-file'
  /** Task-level: it reads the outputs of a task that is itself affected. */
  | 'dependent-output'
  /** Task-level: it hashes every external dependency, and one moved. */
  | 'external-dependencies'
  /** Task-level: its executor hashes outside the plan, so it is always selected. */
  | 'custom-hasher';

export interface AffectedReason {
  kind: AffectedReasonKind;
  /** The changed file responsible, when one file is. */
  file?: string;
  /** The fileset or glob that matched, when the signal came from a pattern. */
  pattern?: string;
  /** The external package whose version moved. */
  package?: string;
  /** The affected project this one depends on. */
  dependency?: string;
  /** The task whose outputs this task reads. */
  producer?: string;
}

/** What `--explain` reports, keyed by project name or task id. */
export interface AffectedExplanation {
  /** The selection, and every reason each entry is in it. */
  affected: Record<string, AffectedReason[]>;
  /**
   * Entries a reason names as the way the change arrived that are not in the
   * selection themselves, followed transitively, so every chain can be traced
   * within the same output.
   */
  dependencies: Record<string, AffectedReason[]>;
}

/**
 * Splits `reasons` by whether the run keeps each entry. A dropped entry still
 * lands in `dependencies` when a kept entry's reason names it, transitively.
 */
export function explainSelection(
  reasons: Record<string, AffectedReason[]>,
  isSelected: (name: string) => boolean
): AffectedExplanation {
  const explanation: AffectedExplanation = { affected: {}, dependencies: {} };
  for (const [name, forName] of Object.entries(reasons)) {
    if (isSelected(name)) {
      explanation.affected[name] = forName;
    }
  }
  const upstream = (forName: AffectedReason[]) =>
    forName.map((r) => r.dependency ?? r.producer).filter(Boolean);
  const pending = Object.values(explanation.affected).flatMap(upstream);
  while (pending.length) {
    const name = pending.pop();
    if (
      name in explanation.affected ||
      name in explanation.dependencies ||
      !(name in reasons)
    ) {
      continue;
    }
    explanation.dependencies[name] = reasons[name];
    pending.push(...upstream(reasons[name]));
  }
  return explanation;
}

/** A reason, bound to the project a locator marked. */
export interface TouchedProject extends AffectedReason {
  project: string;
}

/** One line of `--explain` output, without the leading bullet. */
export function formatAffectedReason(reason: AffectedReason): string {
  switch (reason.kind) {
    case 'project-file':
      return `owns changed file ${reason.file}`;
    case 'implicit-dependency':
      return `input {workspaceRoot}/${reason.pattern} matched ${reason.file}`;
    case 'workspace-configuration':
      return `${reason.file} changed, which can restructure the task graph`;
    case 'deleted-project-configuration':
      return `${reason.file} was deleted`;
    case 'project-configuration':
      return `project configuration in ${reason.file} changed`;
    case 'lockfile':
      return `lockfile ${reason.file} changed`;
    case 'npm-package':
      // The locator falls back to every project when it cannot say which
      // packages moved, and those entries carry no package name.
      return reason.package
        ? `depends on ${reason.package}, whose version changed`
        : `a dependency changed in ${
            reason.file ?? 'package.json'
          }, and could not be matched to a package`;
    case 'tsconfig':
      return `${reason.file} changed, which can affect every project`;
    case 'tsconfig-paths':
      return `a path mapping to it changed in ${reason.file}`;
    case 'dependency':
      return `depends on ${reason.dependency}, which is affected`;
    case 'input-file':
      return reason.pattern
        ? `input ${reason.pattern} matched ${reason.file}`
        : `input matched ${reason.file}`;
    case 'dependent-output':
      return `reads the outputs of ${reason.producer}, which the change reached`;
    case 'external-dependencies':
      return `hashes every external dependency, and ${reason.file} changed`;
    case 'custom-hasher':
      return `its executor uses a custom hasher, so it is always selected`;
  }
}

/**
 * Renders `--explain` output: one block per entity, its reasons beneath it.
 *
 * An entity with no reason is still listed, with a line saying so, because a
 * blank line is indistinguishable from a bug when you are troubleshooting. Only
 * the task path can produce one: project reasons are only ever created by
 * recording one, so a project with none is absent rather than empty.
 */
export function formatAffectedExplanation(
  { affected: reasons, dependencies: carried }: AffectedExplanation,
  heading: string,
  /**
   * Tasks that will run only to satisfy the selected ones. Absent unless the
   * caller is about to run them, so `show projects` never passes it.
   */
  dependencyCount?: number
): string {
  const noun = heading.toLowerCase().includes('task') ? 'task' : 'project';
  const names = Object.keys(reasons).sort();
  if (!names.length) {
    return `Nothing affected.`;
  }

  // Upstream first, the selection last: the reader's own tasks stay at the
  // bottom however long the chain above them grows. Within a group, what the
  // change reached directly comes before what a dependency pulled in.
  const reasonsOf = (name: string) => reasons[name] ?? carried[name] ?? [];
  const reachedThroughDependency = (name: string) =>
    reasonsOf(name).length > 0 && reasonsOf(name).every(isUpstreamReason);
  const upstreamFirst = (group: Record<string, AffectedReason[]>) => {
    const sorted = Object.keys(group).sort();
    return [
      ...sorted.filter((n) => !reachedThroughDependency(n)),
      ...sorted.filter(reachedThroughDependency),
    ];
  };

  const lines = [`${heading} (${names.length}):`, ''];
  const render = (name: string) => {
    lines.push(`  ${name}`);
    const forName = reasonsOf(name);
    if (!forName.length) {
      lines.push(`    - selected, but no reason was recorded`);
    }
    for (const reason of forName) {
      lines.push(`    - ${formatAffectedReason(reason)}`);
    }
    // Every reason names another entry, so say where the chain starts: the
    // reader should not have to follow it up the output to find the file.
    if (reachedThroughDependency(name)) {
      const origins = chainOrigins(name, reasonsOf);
      if (origins.length) {
        const shown = origins.slice(0, 3).join(', ');
        const more =
          origins.length > 3 ? ` and ${origins.length - 3} more` : '';
        lines.push(`    - traced to ${shown}${more}`);
      }
    }
    lines.push('');
  };

  const carriedNames = upstreamFirst(carried);
  if (carriedNames.length) {
    lines.push(
      `Upstream, carried the change here (${carriedNames.length}):`,
      ''
    );
    carriedNames.forEach(render);
    lines.push(
      noun === 'task'
        ? `Your targets (${names.length}):`
        : `Affected projects (${names.length}):`,
      ''
    );
  }
  upstreamFirst(reasons).forEach(render);

  // Same shape as the run summary, which reports the tasks it ran and the ones
  // it ran only to get there.
  const plural = names.length === 1 ? noun : `${noun}s`;
  lines.push(
    dependencyCount === undefined
      ? `${names.length} affected ${plural}.`
      : `${names.length} affected ${plural} and ${dependencyCount} ${
          dependencyCount === 1 ? 'task' : 'tasks'
        } they depend on.`
  );
  return lines.join('\n');
}

/** A reason that names another entry rather than a change. */
function isUpstreamReason(reason: AffectedReason): boolean {
  return reason.kind === 'dependency' || reason.kind === 'dependent-output';
}

/**
 * The changed files, or moved packages, a chain of dependency reasons starts
 * from. Walks the names reasons point at, so a cycle ends and an entry missing
 * from the output is skipped.
 */
function chainOrigins(
  name: string,
  reasonsOf: (name: string) => AffectedReason[]
): string[] {
  const origins = new Set<string>();
  const seen = new Set<string>([name]);
  const pending = [name];
  while (pending.length) {
    for (const reason of reasonsOf(pending.pop())) {
      if (isUpstreamReason(reason)) {
        const upstream = reason.dependency ?? reason.producer;
        if (upstream && !seen.has(upstream)) {
          seen.add(upstream);
          pending.push(upstream);
        }
      } else if (reason.file ?? reason.package) {
        origins.add(reason.file ?? reason.package);
      }
    }
  }
  return [...origins].sort();
}

/** Whether `--explain` was asked for at all, in any of its forms. */
export function isExplaining(value: string | boolean | undefined): boolean {
  return value !== undefined && value !== false;
}
