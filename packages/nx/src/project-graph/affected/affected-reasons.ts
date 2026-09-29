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
  /** A dependency change could not be pinned to packages, so a whole ecosystem moved. */
  | 'moved-ecosystem'
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
  /** The package ecosystem, such as `npm`, that moved whole. */
  ecosystem?: string;
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
  /** The requested targets, and how many of their tasks selection chose among. */
  requested?: { targets: string[]; total: number };
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
    case 'moved-ecosystem':
      return `${
        reason.file ?? 'a dependency manifest'
      } changed and couldn't be narrowed to packages, so every ${
        reason.ecosystem
      } package counts as moved`;
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
 * It follows the chain: what the change touched, what it reached through
 * those, and last the selection itself, so the reader's own entries stay at
 * the bottom however long the chain grows.
 *
 * An entity with no reason is still listed, with a line saying so, because a
 * blank line is indistinguishable from a bug when you are troubleshooting.
 */
export function formatAffectedExplanation(
  { affected, upstream, touched: touchedNames, requested }: AffectedExplanation,
  heading: string,
  { verbose = false }: { verbose?: boolean } = {}
): string {
  const names = Object.keys(affected).sort();
  if (!names.length) {
    return `Nothing affected.`;
  }

  const reasonsOf = (name: string) => affected[name] ?? upstream[name] ?? [];
  const touchedSet = new Set(touchedNames);
  const touched = (name: string) => touchedSet.has(name);

  const lines = [`${heading} (${names.length}):`, ''];
  // The group heading says what changed, so a task's own reasons are all it
  // needs beneath it.
  const detail = (name: string) => {
    lines.push(`    ${name}`);
    const forName = reasonsOf(name);
    if (!forName.length) {
      lines.push(`      - selected, but no reason was recorded`);
    }
    // Grouped even under --verbose: a whole-file package.json change moves
    // thousands of packages per task. The JSON lists them all.
    for (const line of reasonLines(forName)) {
      lines.push(`      - ${line}`);
    }
  };
  // Every section is grouped by what changed, since its tasks would otherwise
  // repeat the same files. A small section, or --verbose, shows every task
  // with its reasons; a large one names up to five tasks per group.
  const section = (header: string | undefined, group: string[]) => {
    if (!group.length) return;
    const detailed = verbose || group.length <= 5;
    const hint = 'Pass --verbose to list each with its reasons.';
    if (header) {
      lines.push(detailed ? `${header}:` : `${header}. ${hint}`, '');
    } else if (!detailed) {
      lines.push(hint, '');
    }
    const byCause = new Map<string, string[]>();
    for (const name of group) {
      const changed = touched(name)
        ? changedIn(reasonsOf(name))
        : chainOrigins(name, reasonsOf);
      const key = `${touched(name) ? 'touched' : 'affected'}\0${describeChanged(changed)}`;
      byCause.set(key, [...(byCause.get(key) ?? []), name]);
    }
    // Touched before affected, so each group follows the one it came from.
    for (const [key, members] of [...byCause].sort(
      ([a, x], [b, y]) =>
        Number(a.startsWith('affected')) - Number(b.startsWith('affected')) ||
        y.length - x.length ||
        a.localeCompare(b)
    )) {
      const [verb, changed] = key.split('\0');
      const count = `${members.length} ${members.length === 1 ? 'task' : 'tasks'}`;
      lines.push(
        `  ${
          !changed
            ? `${count} ${members.length === 1 ? 'was' : 'were'} ${verb} without a changed file to name:`
            : verb === 'touched'
              ? `Changing ${changed} touched ${count}:`
              : `Changing ${changed} affected ${count} through the outputs they read:`
        }`
      );
      if (detailed) {
        members.forEach(detail);
      } else {
        for (const name of members.slice(0, 5)) {
          lines.push(`    - ${name}`);
        }
        if (members.length > 5) {
          lines.push(`    - and ${members.length - 5} more`);
        }
      }
      lines.push('');
    }
  };

  const upstreamNames = Object.keys(upstream).sort();
  const touchedUpstream = upstreamNames.filter(touched);
  const files = new Set(
    touchedUpstream.flatMap((name) => changedIn(reasonsOf(name)))
  );
  section(
    `Changing ${files.size} ${files.size === 1 ? 'file' : 'files'} touched ${
      touchedUpstream.length
    } ${touchedUpstream.length === 1 ? 'task' : 'tasks'} (tasks with 1 or more direct inputs changed)`,
    touchedUpstream
  );
  const reachedUpstream = upstreamNames.filter((name) => !touched(name));
  section(
    `Affected, they read outputs the change reached (${reachedUpstream.length})`,
    reachedUpstream
  );
  // The heading already titles the output when nothing sits above.
  section(
    upstreamNames.length ? `${heading} (${names.length})` : undefined,
    names
  );

  // Out of the requested targets' tasks, so the line says what selection saved.
  const n = names.length;
  const summary = requested
    ? `${n} out of ${requested.total} ${requested.targets.join(', ')} ${
        requested.total === 1 ? 'task' : 'tasks'
      } ${n === 1 ? 'was' : 'were'} affected.`
    : `${n} affected ${n === 1 ? 'task' : 'tasks'}.`;
  lines.push(summary);
  return lines.join('\n');
}

/**
 * One line per reason, except that files matching one input, moved packages,
 * or producers read, share a line naming the first and counting the rest: a
 * refactor or a dependency bump would otherwise print a line per file under
 * every task. The JSON keeps them all.
 * The JSON keeps them all.
 */
function reasonLines(reasons: AffectedReason[]): string[] {
  // Hashing every external covers every package in an ecosystem that moved.
  if (reasons.some((reason) => reason.kind === 'external-dependencies')) {
    reasons = reasons.filter((reason) => reason.kind !== 'moved-ecosystem');
  }
  const grouped = new Map<string, AffectedReason[]>();
  const keyOf = (reason: AffectedReason) => {
    switch (reason.kind) {
      case 'input-file':
        return `input-file\0${reason.pattern ?? ''}`;
      case 'npm-package':
      case 'dependent-output':
      case 'external-dependencies':
      case 'project-configuration':
      case 'deleted-project-configuration':
      case 'lockfile':
        return reason.kind;
      case 'moved-ecosystem':
        return `moved-ecosystem\0${reason.ecosystem}`;
      default:
        return undefined;
    }
  };
  for (const reason of reasons) {
    const key = keyOf(reason);
    if (key) {
      grouped.set(key, [...(grouped.get(key) ?? []), reason]);
    }
  }

  const lines: string[] = [];
  const done = new Set<string>();
  for (const reason of reasons) {
    const key = keyOf(reason);
    const group = key ? grouped.get(key) : undefined;
    if (!group || group.length === 1) {
      lines.push(formatAffectedReason(reason));
      continue;
    }
    if (done.has(key)) continue;
    done.add(key);
    const [first] = group;
    const others = group.length - 1;
    switch (first.kind) {
      case 'input-file':
        lines.push(
          `input ${first.pattern ? `${first.pattern} ` : ''}matched ${
            first.file
          } and ${others} other ${others === 1 ? 'file' : 'files'}`
        );
        break;
      case 'dependent-output':
        lines.push(
          `reads the outputs of ${first.producer} and ${others} other ${
            others === 1 ? 'task' : 'tasks'
          } the change reached`
        );
        break;
      case 'npm-package':
        lines.push(
          `depends on ${first.package} and ${others} other ${
            others === 1 ? 'package' : 'packages'
          }, whose versions changed`
        );
        break;
      default: {
        // The same reason for several files: name them in one.
        const files = group.map((r) => r.file ?? '').sort();
        const joined =
          files.length === 2
            ? `${files[0]} and ${files[1]}`
            : `${files[0]} and ${files.length - 1} other files`;
        lines.push(formatAffectedReason({ ...first, file: joined }));
      }
    }
  }
  return lines;
}

/** The changed files, or packages when no file is known, a task's own reasons name. */
function changedIn(reasons: AffectedReason[]): string[] {
  return [
    ...new Set(
      reasons
        .filter((reason) => !isUpstreamReason(reason))
        .map((reason) => reason.file ?? reason.package)
        .filter(Boolean)
    ),
  ].sort();
}

/** "a", "a and b", or "a and N others". */
function describeChanged(changed: string[]): string {
  return changed.length <= 2
    ? changed.join(' and ')
    : `${changed[0]} and ${changed.length - 1} others`;
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
