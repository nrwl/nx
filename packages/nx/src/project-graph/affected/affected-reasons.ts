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
  /** A lockfile changed. */
  | 'lockfile'
  /** An external package's version moved. */
  | 'npm-package'
  /** The root tsconfig's path mappings changed. */
  | 'tsconfig'
  /** Project-level only: it depends on a project that was touched. */
  | 'dependency'
  /** Task-level: a changed file matched one of the task's inputs. */
  | 'input-file'
  /** Task-level: it reads the outputs of a task that is itself affected. */
  | 'dependent-output'
  /** Task-level: it hashes every external dependency, and one moved. */
  | 'external-dependencies';

export interface AffectedReason {
  kind: AffectedReasonKind;
  /** The changed file responsible, when one file is. */
  file?: string;
  /** The fileset or glob that matched, when the signal came from a pattern. */
  pattern?: string;
  /** The external package whose version moved. */
  package?: string;
  /** The touched project this one depends on. */
  dependency?: string;
  /** The task whose outputs this task reads. */
  producer?: string;
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
      return `path mappings changed in ${reason.file}`;
    case 'dependency':
      return `depends on ${reason.dependency}, which is affected`;
    case 'input-file':
      return reason.pattern
        ? `input ${reason.pattern} matched ${reason.file}`
        : `input matched ${reason.file}`;
    case 'dependent-output':
      return `reads the outputs of ${reason.producer}, which is affected`;
    case 'external-dependencies':
      return `hashes every external dependency, and ${reason.file} changed`;
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
  reasons: Record<string, AffectedReason[]>,
  heading: string,
  /**
   * Tasks that will run only to satisfy the selected ones. Absent unless the
   * caller is about to run them, so `show projects` never passes it.
   */
  dependencies?: number
): string {
  const names = Object.keys(reasons).sort();
  if (!names.length) {
    return `Nothing affected.`;
  }

  // Something the change reached directly is what a reader is looking for; an
  // entry pulled in through a dependency is a consequence of one of those, and
  // in a large answer there are far more of the second kind.
  const reachedThroughDependency = (name: string) => {
    const forName = reasons[name] ?? [];
    return (
      forName.length > 0 &&
      forName.every(
        (r) => r.kind === 'dependency' || r.kind === 'dependent-output'
      )
    );
  };
  const direct = names.filter((n) => !reachedThroughDependency(n));
  const indirect = names.filter(reachedThroughDependency);

  const lines = [`${heading} (${names.length}):`, ''];
  const render = (name: string) => {
    lines.push(`  ${name}`);
    const forName = reasons[name] ?? [];
    if (!forName.length) {
      lines.push(`    - selected, but no reason was recorded`);
    }
    for (const reason of forName) {
      lines.push(`    - ${formatAffectedReason(reason)}`);
    }
    lines.push('');
  };

  // No heading between the groups: each entry's reasons already name the
  // dependency that pulled it in, so a label would only repeat them.
  direct.forEach(render);
  indirect.forEach(render);

  // Same shape as the run summary, which reports the tasks it ran and the ones
  // it ran only to get there.
  const noun = heading.toLowerCase().includes('task') ? 'task' : 'project';
  const plural = names.length === 1 ? noun : `${noun}s`;
  lines.push(
    dependencies === undefined
      ? `${names.length} affected ${plural}.`
      : `${names.length} affected ${plural} and ${dependencies} ${
          dependencies === 1 ? 'task' : 'tasks'
        } they depend on.`
  );
  return lines.join('\n');
}

/** Whether `--explain` was asked for at all, in any of its forms. */
export function isExplaining(value: string | boolean | undefined): boolean {
  return value !== undefined && value !== false;
}
