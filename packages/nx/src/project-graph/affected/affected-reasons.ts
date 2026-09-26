/**
 * Why a task was considered affected.
 *
 * One open shape rather than a discriminated union, because the matches behind
 * these cross the napi boundary as `#[napi(object)]` structs, which carry no
 * tag. `kind` is the discriminant; the rest are populated per kind and absent
 * otherwise.
 *
 * Reasons are collected flat: a task lists every reason that applies to it,
 * and propagation is expressed by naming the producer rather than nesting its
 * reasons, so the producer's own reasons are one lookup away in the same output.
 */
export type AffectedReasonKind =
  /** A changed file matched one of the task's inputs. */
  | 'input-file'
  /** It reads the outputs of a task the change reached. */
  | 'dependent-output'
  /** A project config the task hashes changed. */
  | 'project-configuration'
  /** A project config no longer on disk, so every task was selected. */
  | 'deleted-project-configuration'
  /** A package the task hashes moved, or the root package.json names its project. */
  | 'npm-package'
  /** It hashes every external dependency, and one moved. */
  | 'external-dependencies'
  /** A lockfile changed and `projectsAffectedByDependencyUpdates` names its project. */
  | 'lockfile'
  /** Its executor hashes outside the plan, so it is always selected. */
  | 'custom-hasher';

export interface AffectedReason {
  kind: AffectedReasonKind;
  /** The changed file responsible, when one file is. */
  file?: string;
  /** The input pattern that matched, when the signal came from one. */
  pattern?: string;
  /** The package whose version moved. */
  package?: string;
  /** The task whose outputs this task reads. */
  producer?: string;
}

/** Shown where `--explain` is used without task selection, which is all it explains. */
export const EXPLAIN_NEEDS_TASK_SELECTION =
  '--explain explains which tasks are affected, so it needs task selection: set NX_LEGACY_AFFECTED=false and pass the targets with -t.';

/** What `--explain` reports, keyed by task id. */
export interface AffectedExplanation {
  /** The selection, and every reason each entry is in it. */
  affected: Record<string, AffectedReason[]>;
  /**
   * Tasks the change reached that are not in the selection: those a run keeps,
   * and every producer a reason names, followed transitively, so every chain
   * can be traced within the same output.
   */
  upstream: Record<string, AffectedReason[]>;
  /**
   * The entries of `affected` and `upstream` the change reached directly, as
   * selection decided it; every other entry was reached only through another.
   */
  touched: string[];
  /**
   * Tasks a run keeps only because others need them: the change reached none
   * of them. Each maps to the kept tasks that depend on it. Only when the
   * caller is about to run the selection.
   */
  required?: Record<string, string[]>;
}

/** One line of `--explain` output, without the leading bullet. */
export function formatAffectedReason(reason: AffectedReason): string {
  switch (reason.kind) {
    case 'deleted-project-configuration':
      return `${reason.file} was deleted`;
    case 'project-configuration':
      return `project configuration in ${reason.file} changed`;
    case 'lockfile':
      return `lockfile ${reason.file} changed`;
    case 'npm-package':
      return `depends on ${reason.package}, whose version changed`;
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
 * With nothing upstream or required it is one list. Otherwise it is laid out
 * as the run goes: what runs only because it is needed, what the change
 * touched, what it reached through those, and last the selection itself, so
 * the reader's own entries stay at the bottom however long the chain grows.
 *
 * An entity with no reason is still listed, with a line saying so, because a
 * blank line is indistinguishable from a bug when you are troubleshooting.
 */
export function formatAffectedExplanation(
  {
    affected,
    upstream,
    touched: touchedNames,
    required = {},
  }: AffectedExplanation,
  heading: string,
  /**
   * Tasks that will run only to satisfy the selected ones. Absent unless the
   * caller is about to run them, so `show projects` never passes it.
   */
  dependencyCount?: number
): string {
  const names = Object.keys(affected).sort();
  if (!names.length) {
    return `Nothing affected.`;
  }

  const reasonsOf = (name: string) => affected[name] ?? upstream[name] ?? [];
  const touchedSet = new Set(touchedNames);
  const touched = (name: string) => touchedSet.has(name);
  const touchedFirst = (group: string[]) => [
    ...group.filter(touched),
    ...group.filter((name) => !touched(name)),
  ];

  const lines = [`${heading} (${names.length}):`, ''];
  const render = (name: string, withLayer = false) => {
    lines.push(`  ${name}`);
    if (withLayer) {
      lines.push(
        touched(name)
          ? `    - touched: its own inputs changed`
          : `    - affected: reads outputs the change reached`
      );
    }
    const forName = reasonsOf(name);
    if (!forName.length) {
      lines.push(`    - selected, but no reason was recorded`);
    }
    for (const reason of forName) {
      lines.push(`    - ${formatAffectedReason(reason)}`);
    }
    // Every reason names another entry, so say where the chain starts: the
    // reader should not have to follow it up the output to find the file.
    if (!touched(name)) {
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
  const section = (title: string, group: string[]) => {
    if (group.length) {
      lines.push(`${title} (${group.length}):`, '');
      group.forEach((name) => render(name));
    }
  };

  const upstreamNames = Object.keys(upstream).sort();
  const requiredNames = Object.keys(required).sort();
  if (!upstreamNames.length && !requiredNames.length) {
    touchedFirst(names).forEach((name) => render(name));
  } else {
    if (requiredNames.length) {
      lines.push(
        `Dependencies, needed to run first (${requiredNames.length}):`,
        ''
      );
      for (const name of requiredNames) {
        const by = required[name];
        const more = by.length > 2 ? ` and ${by.length - 2} more` : '';
        lines.push(
          by.length
            ? `  ${name}, needed by ${by.slice(0, 2).join(', ')}${more}`
            : `  ${name}`
        );
      }
      lines.push('');
    }
    section(`Touched, their own inputs changed`, upstreamNames.filter(touched));
    section(
      `Affected, they read outputs the change reached`,
      upstreamNames.filter((name) => !touched(name))
    );
    lines.push(`${heading} (${names.length}):`, '');
    touchedFirst(names).forEach((name) => render(name, true));
  }

  // Same shape as the run summary, which reports the tasks it ran and the ones
  // it ran only to get there.
  const plural = names.length === 1 ? 'task' : 'tasks';
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
  return reason.kind === 'dependent-output';
}

/**
 * The changed files, or moved packages, a chain of output reads starts
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
        const upstream = reason.producer;
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
