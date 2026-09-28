import type { NpmDependencyV3 } from '../npm-parser';
import { resolvePlacedPath } from './npm-placement';

type EdgeType = 'prod' | 'dev' | 'optional' | 'peer' | 'peerOptional';

type DepFlags = {
  extraneous: boolean;
  dev: boolean;
  optional: boolean;
  devOptional: boolean;
  peer: boolean;
};

// shrinkwrap.js's swKeyOrder
const NPM_KEY_ORDER = [
  'name',
  'version',
  'lockfileVersion',
  'resolved',
  'integrity',
  'requires',
  'packages',
  'dependencies',
];

// Recomputes the pruned tree's dep flags as npm's calc-dep-flags.js does: npm
// trusts them when the lock file's root matches package.json.
export function setNpmDependencyFlags(
  packages: Record<string, NpmDependencyV3>
): Record<string, NpmDependencyV3> {
  // npm prunes what nothing reaches whenever it recalculates the flags, so
  // trusting them must not install it either; the rest is flagged without it.
  const reached = calculateDependencyFlags(new Map(Object.entries(packages)));
  const tree = new Map(
    Object.entries(packages).filter(([path]) => !reached.get(path).extraneous)
  );
  const flags = calculateDependencyFlags(tree);

  const output: Record<string, NpmDependencyV3> = {};
  for (const [path, snapshot] of tree) {
    output[path] =
      path && !snapshot.link
        ? withDependencyFlags(snapshot, flags.get(path))
        : snapshot;
  }
  return output;
}

function calculateDependencyFlags(
  tree: Map<string, NpmDependencyV3>
): Map<string, DepFlags> {
  const flags = new Map<string, DepFlags>();
  for (const path of tree.keys()) {
    const initial = path !== '';
    flags.set(path, {
      extraneous: initial,
      dev: initial,
      optional: initial,
      devOptional: initial,
      peer: initial,
    });
  }

  const seen = new Set<string>();
  const queue = [''];
  while (queue.length) {
    const path = queue.pop();
    seen.add(path);
    const node = flags.get(path);
    if (!node.extraneous) {
      for (
        let parent = getResolveParent(path);
        parent !== undefined && flags.get(parent)?.extraneous;
        parent = getResolveParent(parent)
      ) {
        flags.get(parent).extraneous = false;
      }
    }

    const snapshot = tree.get(path);
    if (snapshot.link) {
      if (flags.has(snapshot.resolved)) {
        Object.assign(flags.get(snapshot.resolved), node);
        queue.push(snapshot.resolved);
      }
      continue;
    }

    for (const [name, type] of getEdgesOut(path, snapshot)) {
      const to = resolvePlacedPath(tree, path, name);
      if (!to) {
        continue;
      }
      const target = flags.get(to);
      const peer = type === 'peer' || type === 'peerOptional';
      const optional = type === 'optional' || type === 'peerOptional';
      const dev = type === 'dev';
      let changed = false;
      if (target.extraneous && !node.extraneous && !(peer && optional)) {
        target.extraneous = false;
        changed = true;
      }
      if (target.dev && !node.dev && !dev) {
        target.dev = false;
        changed = true;
      }
      if (target.optional && !node.optional && !optional) {
        target.optional = false;
        changed = true;
      }
      if (
        target.devOptional &&
        !node.devOptional &&
        !node.dev &&
        !node.optional &&
        !dev &&
        !optional
      ) {
        target.devOptional = false;
        changed = true;
      }
      if (target.peer && !node.peer && !peer) {
        target.peer = false;
        changed = true;
      }
      if (changed) {
        queue.push(to);
      }
    }
  }
  seen.delete('');
  for (const path of seen) {
    const node = flags.get(path);
    if (node.devOptional && (node.dev || node.optional)) {
      node.devOptional = false;
    }
  }
  return flags;
}

// The edges npm's Node loads from a lock file entry; a later type replaces an
// earlier one. Only packages outside node_modules get their devDependencies.
function getEdgesOut(
  path: string,
  snapshot: NpmDependencyV3
): Map<string, EdgeType> {
  const edges = new Map<string, EdgeType>();
  for (const name of Object.keys(snapshot.peerDependencies ?? {})) {
    edges.set(
      name,
      snapshot.peerDependenciesMeta?.[name]?.optional ? 'peerOptional' : 'peer'
    );
  }
  const loaded: [Record<string, string> | undefined, EdgeType][] = [
    [snapshot.dependencies, 'prod'],
    [snapshot.optionalDependencies, 'optional'],
  ];
  if (!path.includes('node_modules/')) {
    loaded.push([snapshot.devDependencies, 'dev']);
  }
  for (const [deps, type] of loaded) {
    for (const name of Object.keys(deps ?? {})) {
      edges.set(name, type);
    }
  }
  return edges;
}

function getResolveParent(path: string): string | undefined {
  if (!path) {
    return undefined;
  }
  const parent = path.lastIndexOf('/node_modules/');
  return parent === -1 ? '' : path.slice(0, parent);
}

// Written as shrinkwrap.js writes them, in the key order npm writes an entry.
function withDependencyFlags(
  snapshot: NpmDependencyV3,
  flags: DepFlags
): NpmDependencyV3 {
  const { extraneous, dev, optional, devOptional, peer, ...rest } =
    snapshot as NpmDependencyV3 & { extraneous?: boolean };
  const written = {
    ...(flags.peer && { peer: true }),
    ...(flags.dev && { dev: true }),
    ...(flags.optional && { optional: true }),
    ...(flags.devOptional &&
      !flags.dev &&
      !flags.optional && { devOptional: true }),
  };
  return Object.fromEntries(
    Object.entries({ ...rest, ...written }).sort(compareNpmKeys)
  ) as NpmDependencyV3;
}

// json-stringify-nice's order: scalars before objects, NPM_KEY_ORDER first,
// then alphabetical.
function compareNpmKeys(
  [a, aValue]: [string, unknown],
  [b, bValue]: [string, unknown]
): number {
  const aIsObject = isObject(aValue);
  if (aIsObject !== isObject(bValue)) {
    return aIsObject ? 1 : -1;
  }
  const aOrder = NPM_KEY_ORDER.indexOf(a);
  const bOrder = NPM_KEY_ORDER.indexOf(b);
  if (aOrder === -1 && bOrder === -1) {
    return a.localeCompare(b, 'en');
  }
  if (aOrder === -1 || bOrder === -1) {
    return aOrder === -1 ? 1 : -1;
  }
  return aOrder - bOrder;
}

function isObject(value: unknown): boolean {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
