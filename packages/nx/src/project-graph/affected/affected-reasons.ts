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

/**
 * Why `--explain` cannot run here, naming only what is missing or in the way.
 * It explains task selection, so it needs what task selection needs.
 */
export function explainUnavailable(
  missing: string[],
  conflicting: string[] = []
): string {
  const sentences = [
    missing.length && `--explain needs ${listed(missing)}.`,
    conflicting.length &&
      `--explain can't be combined with ${listed(conflicting)}.`,
  ].filter(Boolean);
  return sentences.length
    ? sentences.join(' ')
    : '--explain only works with nx affected and nx show projects --affected.';
}

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
  /** The packages each changed dependency file moved, when Nx could name them. */
  moved?: Record<string, string[]>;
}

/**
 * One line of `--explain` output, without the leading bullet. `many` is set
 * when `file` names several files.
 */
export function formatAffectedReason(
  reason: AffectedReason,
  many = false
): string {
  const changes = many ? 'change' : 'changes';
  switch (reason.kind) {
    case 'deleted-project-configuration':
      return `${reason.file} ${many ? 'are' : 'is'} deleted`;
    case 'project-configuration':
      return `project configuration in ${reason.file} ${changes}`;
    case 'lockfile':
      return `lockfile ${reason.file} ${changes}`;
    case 'npm-package':
      return `depends on ${reason.package}, whose version changes`;
    case 'moved-ecosystem':
      return `${
        reason.file ?? 'a dependency manifest'
      } ${changes} and can't be narrowed to packages, so every ${
        reason.ecosystem
      } package counts as moved`;
    case 'input-file':
      return reason.pattern
        ? `${reason.file} matches ${reason.pattern}`
        : `${reason.file} matches an input`;
    case 'dependent-output':
      return `reads the outputs of ${reason.producer}`;
    case 'external-dependencies':
      return `hashes every external dependency, and ${reason.file} ${changes}`;
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
  {
    affected,
    upstream,
    touched: touchedNames,
    requested,
    moved = {},
  }: AffectedExplanation,
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
    ? `${n} out of ${requested.total} ${listed(requested.targets)} ${
        requested.total === 1 ? 'task' : 'tasks'
      } ${n === 1 ? 'is' : 'are'} affected`
    : `${heading} (${n})`;
  const lines = [`${title}:`, ''];
  const tasks = (count: number) => `${count} ${count === 1 ? 'task' : 'tasks'}`;
  // The tasks asked for are marked by count and listed first in each group,
  // rather than split into a section of their own, so each cause shows once.
  const requestedSet = new Set(names);
  // Your tasks are counted per target, in the order the targets were given.
  const targets = requested?.targets ?? [];
  const targetOf = (name: string) =>
    targets.find(
      (target) => name.endsWith(`:${target}`) || name.includes(`:${target}:`)
    ) ?? 'requested';
  const breakdown = (group: string[], other: string) => {
    const byTarget = new Map<string, number>(
      [...targets, 'requested'].map((target) => [target, 0])
    );
    let rest = 0;
    for (const name of group) {
      if (requestedSet.has(name)) {
        const target = targetOf(name);
        byTarget.set(target, byTarget.get(target) + 1);
      } else {
        rest++;
      }
    }
    const parts = [...byTarget]
      .filter(([, count]) => count)
      .map(
        ([target, count]) =>
          `${count} ${other}${target} ${count === 1 ? 'task' : 'tasks'}`
      );
    return { parts, rest };
  };
  const counted = (group: string[]) => {
    const { parts, rest } = breakdown(group, '');
    if (!parts.length) return tasks(rest);
    return listed(
      rest
        ? [...parts, `${rest} other ${rest === 1 ? 'task' : 'tasks'}`]
        : parts
    );
  };
  // The tasks a list leaves out, as "N other build tasks and M other tasks".
  const otherCounted = (group: string[]) => {
    const { parts, rest } = breakdown(group, 'other ');
    return listed(
      rest
        ? [...parts, `${rest} other ${rest === 1 ? 'task' : 'tasks'}`]
        : parts
    );
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
    for (const line of reasonLines(forName, moved)) {
      lines.push(`${indent}  - ${line}`);
    }
  };
  // --verbose shows each task with its reasons; otherwise up to five names.
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
      lines.push(`${indent}- and ${otherCounted(ordered.slice(5))}`);
    }
  };
  const hint = '. Pass --verbose to list each with its reasons.';

  const all = [...new Set([...names, ...Object.keys(upstream)])].sort();
  const touchedAll = all.filter(touched);
  const reachedAll = all.filter((name) => !touched(name));

  // Touched tasks: a section for files, then one for packages, each grouped
  // by what changed. A task touched by both is listed in each.
  const kinds = [
    { noun: 'file' as const, groups: new Map<string, string[]>() },
    { noun: 'package' as const, groups: new Map<string, string[]>() },
  ];
  const unnamed: string[] = [];
  for (const name of touchedAll) {
    const changed = changedIn(reasonsOf(name), moved);
    if (!changed.length) unnamed.push(name);
    for (const { noun, groups } of kinds) {
      const ofKind = changed.filter(
        (change) => change.isPackage === (noun === 'package')
      );
      if (!ofKind.length) continue;
      const key = describeChanged(ofKind, noun);
      groups.set(key, [...(groups.get(key) ?? []), name]);
    }
  }
  for (const { noun, groups } of kinds) {
    if (!groups.size) continue;
    const members = [...new Set([...groups.values()].flat())];
    const sorted = [...groups].sort(
      ([a, x], [b, y]) => y.length - x.length || a.localeCompare(b)
    );
    const changes = new Set(
      members.flatMap((name) =>
        changedIn(reasonsOf(name), moved)
          .filter((change) => change.isPackage === (noun === 'package'))
          .map((change) => change.name)
      )
    );
    const header = `Changing ${changes.size} ${noun}${
      changes.size === 1 ? '' : 's'
    } touches ${counted(members)}`;
    lines.push(verbose ? `${header}:` : `${header}${hint}`);
    for (const [changed, inGroup] of sorted) {
      lines.push('', `  ${changed}:`);
      list(inGroup, '    ', verbose);
    }
    lines.push('');
  }
  if (unnamed.length) {
    const header = `${counted(unnamed)} ${
      unnamed.length === 1 ? 'is' : 'are'
    } touched with no changed file to name`;
    lines.push(verbose ? `${header}:` : `${header}${hint}`);
    list(unnamed, '  ', verbose);
    lines.push('');
  }

  // Tasks reached only through outputs the touched ones changed.
  if (reachedAll.length) {
    const header = `Touching those tasks changes outputs read by ${counted(reachedAll)}`;
    lines.push(verbose ? `${header}:` : `${header}${hint}`);
    list(reachedAll, '  ', verbose);
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
function reasonLines(
  reasons: AffectedReason[],
  moved: Record<string, string[]>
): string[] {
  const externals = reasons.filter(
    (reason) => reason.kind === 'external-dependencies'
  );
  const movedPackages = [
    ...new Set(externals.flatMap((reason) => moved[reason.file] ?? [])),
  ].sort();
  // Hashing every external covers every package in an ecosystem that moved,
  // unless the line names packages instead of files.
  if (externals.length && !movedPackages.length) {
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
    if (reason.kind === 'external-dependencies' && movedPackages.length) {
      if (done.has(key)) continue;
      done.add(key);
      const [first] = movedPackages;
      const others = movedPackages.length - 1;
      lines.push(
        `hashes every external dependency, including ${first}${
          others
            ? ` and ${others} other ${others === 1 ? 'package' : 'packages'}`
            : ''
        }, which moved`
      );
      continue;
    }
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
        lines.push(formatAffectedReason({ ...first, file: joined }, true));
      }
    }
  }
  return lines;
}

interface Changed {
  name: string;
  isPackage: boolean;
}

/**
 * What a task's own reasons name as changed: a moved package by its name,
 * anything else by its file.
 */
function changedIn(
  reasons: AffectedReason[],
  moved: Record<string, string[]>
): Changed[] {
  const changed = new Map<string, Changed>();
  const add = (name: string | undefined, isPackage: boolean) => {
    if (name) changed.set(name, { name, isPackage });
  };
  for (const reason of reasons) {
    if (isUpstreamReason(reason)) continue;
    const packages =
      reason.kind === 'external-dependencies' ? moved[reason.file] : undefined;
    if (packages?.length) {
      packages.forEach((name) => add(name, true));
    } else if (reason.kind === 'npm-package') {
      add(reason.package, true);
    } else {
      add(reason.file, false);
    }
  }
  return [...changed.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** "a", "a and b", or "a and N other files". */
function describeChanged(changed: Changed[], noun: 'file' | 'package'): string {
  if (changed.length <= 2) {
    return changed.map((change) => change.name).join(' and ');
  }
  return `${changed[0].name} and ${changed.length - 1} other ${noun}s`;
}

/** A reason that names another entry rather than a change. */
function isUpstreamReason(reason: AffectedReason): boolean {
  return reason.kind === 'dependent-output';
}

/** Whether `--explain` was asked for at all, in any of its forms. */
export function isExplaining(value: string | boolean | undefined): boolean {
  return value !== undefined && value !== false;
}

/** "a", "a and b", or "a, b and c". */
function listed(items: string[]): string {
  return items.length <= 2
    ? items.join(' and ')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
