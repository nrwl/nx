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
      return `${reason.file} is deleted`;
    case 'project-configuration':
      return `project configuration in ${reason.file} changes`;
    case 'lockfile':
      return `lockfile ${reason.file} changes`;
    case 'npm-package':
      return `depends on ${reason.package}, whose version changes`;
    case 'moved-ecosystem':
      return `${
        reason.file ?? 'a dependency manifest'
      } changes and can't be narrowed to packages, so every ${
        reason.ecosystem
      } package counts as moved`;
    case 'input-file':
      return reason.pattern
        ? `${reason.file} matches ${reason.pattern}`
        : `${reason.file} matches an input`;
    case 'dependent-output':
      return `reads the outputs of ${reason.producer}`;
    case 'external-dependencies':
      return `hashes every external dependency, and ${reason.file} changes`;
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
  {
    verbose = false,
    styleTask = (id: string) => id,
  }: {
    verbose?: boolean;
    /** Styles a listed task id; plain unless the printer passes a style. */
    styleTask?: (id: string, requested: boolean) => string;
  } = {}
): string {
  const names = Object.keys(affected).sort();
  if (!names.length) {
    return `Nothing affected.`;
  }

  const reasonsOf = (name: string) => affected[name] ?? upstream[name] ?? [];
  const touchedSet = new Set(touchedNames);
  const touched = (name: string) => touchedSet.has(name);

  // Out of the requested targets' tasks, so the title says what selection saved.
  const n = names.length;
  const title = requested
    ? `${n} out of ${requested.total} ${requested.targets.join(', ')} ${
        requested.total === 1 ? 'task' : 'tasks'
      } ${n === 1 ? 'is' : 'are'} affected`
    : `${heading} (${n})`;
  const lines = [`${title}:`, ''];
  const tasks = (count: number) => `${count} ${count === 1 ? 'task' : 'tasks'}`;
  // The tasks asked for are marked by count and listed first in each group,
  // rather than split into a section of their own, so each cause shows once.
  const requestedSet = new Set(names);
  const asked = requested?.targets.join(', ') ?? 'requested';
  const counted = (group: string[]) => {
    const mine = group.filter((name) => requestedSet.has(name)).length;
    const others = group.length - mine;
    if (!mine) return tasks(others);
    const own = `${mine} ${asked} ${mine === 1 ? 'task' : 'tasks'}`;
    return others
      ? `${own} and ${others} other ${others === 1 ? 'task' : 'tasks'}`
      : own;
  };
  const requestedFirst = (group: string[]) => [
    ...group.filter((name) => requestedSet.has(name)),
    ...group.filter((name) => !requestedSet.has(name)),
  ];

  const shown = (name: string) => styleTask(name, requestedSet.has(name));
  const detail = (name: string, indent: string) => {
    lines.push(`${indent}${shown(name)}`);
    const forName = reasonsOf(name);
    if (!forName.length) {
      lines.push(`${indent}  - selected, but no reason is recorded`);
    }
    for (const line of reasonLines(forName)) {
      lines.push(`${indent}  - ${line}`);
    }
  };
  // A small list, or --verbose, shows each task with its reasons; a large one
  // names up to five.
  const list = (group: string[], indent: string, detailed: boolean) => {
    const ordered = requestedFirst(group);
    if (detailed) {
      ordered.forEach((name) => detail(name, indent));
      return;
    }
    for (const name of ordered.slice(0, 5)) {
      lines.push(`${indent}- ${shown(name)}`);
    }
    if (ordered.length > 5) {
      lines.push(`${indent}- and ${ordered.length - 5} more`);
    }
  };
  const hint = '. Pass --verbose to list each with its reasons.';

  const all = [...new Set([...names, ...Object.keys(upstream)])].sort();
  const touchedAll = all.filter(touched);
  const reachedAll = all.filter((name) => !touched(name));

  // Touched tasks, grouped by the changed files their own inputs name.
  if (touchedAll.length) {
    const detailed = verbose || touchedAll.length <= 5;
    const byFiles = new Map<string, string[]>();
    for (const name of touchedAll) {
      const key = describeChanged(changedIn(reasonsOf(name)));
      byFiles.set(key, [...(byFiles.get(key) ?? []), name]);
    }
    const groups = [...byFiles].sort(
      ([a, x], [b, y]) => y.length - x.length || a.localeCompare(b)
    );
    const files = new Set(
      touchedAll.flatMap((name) => changedIn(reasonsOf(name)))
    );
    const touchedBy = (changed: string, members: string[]) =>
      changed
        ? `Changing ${changed} touches ${counted(members)}`
        : `${counted(members)} ${members.length === 1 ? 'is' : 'are'} touched with no changed file to name`;
    const header = `${
      groups.length === 1
        ? touchedBy(groups[0][0], touchedAll)
        : `Changing ${files.size} ${files.size === 1 ? 'file' : 'files'} touches ${counted(touchedAll)}`
    } (tasks where 1 or more direct inputs change)`;
    lines.push(detailed ? `${header}:` : `${header}${hint}`);
    if (groups.length === 1) {
      list(touchedAll, '  ', detailed);
    } else {
      for (const [changed, members] of groups) {
        lines.push(
          '',
          `  ${changed || 'no changed file to name'} -> ${counted(members)}:`
        );
        list(members, '    ', detailed);
      }
    }
    lines.push('');
  }

  // Tasks reached only through outputs the touched ones changed.
  if (reachedAll.length) {
    const detailed = verbose || reachedAll.length <= 5;
    const header = touchedAll.length
      ? `Touching those tasks changes outputs read by ${counted(reachedAll)}`
      : `The change reaches outputs read by ${counted(reachedAll)}`;
    lines.push(detailed ? `${header}:` : `${header}${hint}`);
    list(reachedAll, '  ', detailed);
    lines.push('');
  }

  lines.pop();
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
          `${first.file} and ${others} other ${
            others === 1 ? 'file' : 'files'
          } match ${first.pattern ?? 'an input'}`
        );
        break;
      case 'dependent-output':
        lines.push(
          `reads the outputs of ${first.producer} and ${others} other ${
            others === 1 ? 'task' : 'tasks'
          }`
        );
        break;
      case 'npm-package':
        lines.push(
          `depends on ${first.package} and ${others} other ${
            others === 1 ? 'package' : 'packages'
          }, whose versions change`
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

/** Whether `--explain` was asked for at all, in any of its forms. */
export function isExplaining(value: string | boolean | undefined): boolean {
  return value !== undefined && value !== false;
}
