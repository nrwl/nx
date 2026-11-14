/**
 * pnpm v12.21's v13 wire format keeps peer bindings as properties instead of
 * peer-suffixed references. Adapt it to Nx's existing snapshot model while
 * retaining the wire bindings for pruning and serialization.
 *
 * Format: https://github.com/pnpm/pnpm/blob/b8d388835f9a40ee1ac53fbc2d4b58c3ebfa5600/pnpm/crates/lockfile/src/next_format.rs
 * Selection: https://github.com/pnpm/pnpm/blob/b8d388835f9a40ee1ac53fbc2d4b58c3ebfa5600/pnpm/crates/lockfile/src/next_format/read/choose.rs
 * References: https://github.com/pnpm/pnpm/blob/b8d388835f9a40ee1ac53fbc2d4b58c3ebfa5600/pnpm/crates/lockfile/src/next_format/reference.rs
 *
 * The internal `(nx-v13-N)` keys distinguish snapshots only within Nx. They
 * are not pnpm peer hashes and are never written into the v13 document.
 */
import type {
  Lockfile,
  PackageSnapshot,
  ProjectSnapshot,
} from '@pnpm/lockfile-types';
import { posix } from 'node:path';

type Fields = Record<string, unknown>;
type Bindings = Record<string, Reference>;
type Reference = string | { version: string; with?: Bindings };
type Peer =
  | string
  | {
      specifier?: string;
      version?: string;
      with?: Bindings;
      optional?: boolean;
      below?: boolean;
    };
interface Snapshot extends Fields {
  dependencies?: Record<string, Reference>;
  optionalDependencies?: Record<string, Reference>;
  peerDependencies?: Record<string, Peer>;
  unboundPeerDependencies?: string[];
  optional?: boolean;
}
interface Package extends Snapshot {
  integrity?: string;
  resolution?: Fields;
  snapshots?: Snapshot[];
}
interface Importer extends Fields {
  name?: string;
  dependencies?: Record<string, string | ImporterDependency>;
  devDependencies?: Record<string, string | ImporterDependency>;
  optionalDependencies?: Record<string, string | ImporterDependency>;
}
interface ImporterDependency {
  specifier: string;
  version?: string;
  with?: Bindings;
}
export interface PnpmLockfileV13 extends Fields {
  lockfileVersion: string;
  settings?: Fields;
  projects: Record<string, Importer>;
  packages: Record<string, Package>;
}
interface Variant {
  key: string;
  sourceKey: string;
  source: Package;
  snapshot: Snapshot;
  bindings: Bindings;
  normalized?: PackageSnapshot;
}
interface Metadata {
  variants: Map<string, Variant>;
  importers: Record<string, Importer>;
  normalizedImporters: Record<string, ProjectSnapshot>;
}

// Enumerable symbols survive the pruning code's object spreads, but YAML only
// sees string keys. Keep wire bindings, not legacy peer hashes: hashes cannot
// encode the information needed to write v13 back without loss.
const metadata = Symbol('pnpm lockfile v13');
const packageMetadata = Symbol('pnpm lockfile v13 snapshot');
const importerMetadata = Symbol('pnpm lockfile v13 source importer');
type Normalized = Lockfile & { [metadata]?: Metadata };
const dependencyFields = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
] as const;
const graphFields = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'unboundPeerDependencies',
  'optional',
  'id',
  'snapshots',
] as const;
const settingSections = [
  'catalogs',
  'overrides',
  'patchedDependencies',
  'packageExtensionsChecksum',
  'pnpmfileChecksum',
  'ignoredOptionalDependencies',
] as const;

export function isPnpmLockfileV13(input: unknown): boolean {
  if (!isObject(input)) return false;
  return /^(?:13)(?:\.\d+)?$/.test(String(input.lockfileVersion));
}

export function normalizePnpmLockfileV13(input: unknown): Lockfile {
  if (!isObject(input) || !isPnpmLockfileV13(input)) {
    throw new Error('Expected a pnpm lockfile with lockfileVersion 13');
  }
  const raw = structuredClone(input);
  const wirePackages = (raw.packages ?? {}) as Record<string, Package>;
  const wireImporters = (raw.projects ?? raw.importers ?? {}) as Record<
    string,
    Importer
  >;
  const settings = { ...((raw.settings ?? {}) as Fields) };
  const lifted: Fields = {};
  for (const field of settingSections) {
    if (field in settings) {
      lifted[field] = settings[field];
      delete settings[field];
    }
  }
  const variants = new Map<string, Variant>();
  const byPackage = new Map<string, Variant[]>();
  for (const [key, source] of Object.entries(wirePackages)) {
    const snapshots = source.snapshots?.length ? source.snapshots : [{}];
    const entries = snapshots.map((snapshot, index) => {
      const effective: Snapshot = { ...source, ...snapshot };
      for (const field of ['dependencies', 'optionalDependencies'] as const) {
        if (source[field] || snapshot[field]) {
          // pnpm's shared graph entries take precedence over snapshot entries.
          effective[field] = { ...snapshot[field], ...source[field] } as never;
        }
      }
      if (source.peerDependencies || snapshot.peerDependencies) {
        effective.peerDependencies = mergePeers(
          source.peerDependencies,
          snapshot.peerDependencies
        );
      }
      effective.optional = !!(source.optional || snapshot.optional);
      delete effective.snapshots;
      const bindings = peerBindings(effective.peerDependencies);
      const variant: Variant = {
        key: snapshots.length > 1 ? `${key}(nx-v13-${index})` : key,
        sourceKey: key,
        source,
        snapshot: effective,
        bindings,
      };
      variants.set(variant.key, variant);
      return variant;
    });
    byPackage.set(key, entries);
  }
  const importers: Record<string, ProjectSnapshot> = {};
  const resolvedImporters: Record<string, Importer> = {};
  const implied = (id: string, name: string, specifier: string): string => {
    if (specifier.startsWith('catalog:')) {
      const catalog = specifier.slice(8) || 'default';
      const entry = (
        lifted.catalogs as Record<
          string,
          Record<string, string | ImporterDependency>
        >
      )?.[catalog]?.[name];
      if (entry === undefined)
        throw new Error(`Missing pnpm catalog ${catalog} entry for ${name}`);
      const spec = typeof entry === 'string' ? entry : entry.specifier;
      const version =
        typeof entry === 'string'
          ? aliasParts(entry.replace(/^npm:/, '')).version
          : (entry.version ?? aliasParts(spec.replace(/^npm:/, '')).version);
      return spec.startsWith('npm:')
        ? `${aliasParts(spec.slice(4)).name}@${version}`
        : version;
    }
    if (specifier.startsWith('workspace:')) {
      const target = specifier.slice(10);
      const alias = aliasParts(target);
      const packageName = alias.name ?? name;
      const injected = [...byPackage.keys()].filter((key) =>
        key.startsWith(`${packageName}@file:`)
      );
      const linked = Object.entries(wireImporters).filter(
        ([, importer]) => importer.name === packageName
      );
      if (injected.length === 1 && linked.length === 0) {
        const version = injected[0].slice(packageName.length + 1);
        return packageName === name ? version : `${packageName}@${version}`;
      }
      if (linked.length === 1 && injected.length === 0)
        return `link:${posix.relative(id, linked[0][0]) || '.'}`;
      throw new Error(
        `Cannot derive pnpm workspace version for ${name} in ${id}`
      );
    }
    return specifier.replace(/^npm:/, '');
  };
  for (const [id, importer] of Object.entries(wireImporters)) {
    const resolved = { ...importer };
    for (const field of dependencyFields) {
      if (!importer[field]) continue;
      resolved[field] = Object.fromEntries(
        Object.entries(importer[field]).map(([name, entry]) => {
          const dep = typeof entry === 'string' ? { specifier: entry } : entry;
          return [
            name,
            {
              ...dep,
              version: dep.version ?? implied(id, name, dep.specifier),
            },
          ];
        })
      );
    }
    resolvedImporters[id] = resolved;
  }
  // Match pnpm's v13 read/choose.rs: explicit bindings first, otherwise the
  // best agreeing scope, then the fewest absent bindings and source order.
  const choose = (
    name: string,
    reference: Reference,
    scope: Bindings,
    self?: string
  ): Variant | undefined => {
    const candidates = byPackage.get(referenceKey(name, reference));
    if (!candidates?.length) return;
    if (candidates.length === 1) return candidates[0];
    if (typeof reference !== 'string' && reference.with !== undefined) {
      const matches = candidates.filter((candidate) =>
        Object.entries(reference.with).every(([peer, wanted]) => {
          const actual = candidate.bindings[peer];
          return actual !== undefined && sameNamedBinding(wanted, actual);
        })
      );
      if (matches.length)
        return matches.reduce((best, entry) =>
          Object.keys(entry.bindings).length < Object.keys(best.bindings).length
            ? entry
            : best
        );
    }
    let best: Variant | undefined;
    let bestAgree = -1;
    let bestAbsent = Infinity;
    for (const candidate of candidates) {
      let agree = 0;
      let absent = 0;
      let conflict = false;
      for (const [peer, ref] of Object.entries(candidate.bindings)) {
        if (scope[peer] !== undefined) {
          if (referenceKey(peer, scope[peer]) !== referenceKey(peer, ref)) {
            conflict = true;
            break;
          }
          agree++;
        } else if (self === referenceKey(peer, ref)) agree++;
        else absent++;
      }
      if (
        !conflict &&
        (agree > bestAgree || (agree === bestAgree && absent < bestAbsent))
      ) {
        best = candidate;
        bestAgree = agree;
        bestAbsent = absent;
      }
    }
    return best ?? candidates[0];
  };
  const normalizeRef = (
    name: string,
    ref: Reference,
    scope: Bindings,
    self?: string
  ): string => {
    const selected = choose(name, ref, scope, self);
    return selected ? referenceFor(name, selected.key) : refVersion(ref);
  };
  for (const [id, importer] of Object.entries(resolvedImporters)) {
    const output = {
      ...importer,
      specifiers: {},
    } as unknown as ProjectSnapshot;
    const scope: Bindings = {};
    for (const field of dependencyFields) {
      for (const [name, dep] of Object.entries(importer[field] ?? {})) {
        const entry = dep as ImporterDependency;
        scope[name] = {
          version: entry.version!,
          ...(entry.with === undefined ? {} : { with: entry.with }),
        };
      }
    }
    for (const field of dependencyFields) {
      if (!importer[field]) continue;
      output[field] = {};
      for (const [name, dep] of Object.entries(importer[field])) {
        const entry = dep as ImporterDependency;
        output.specifiers[name] = entry.specifier;
        output[field][name] = normalizeRef(name, scope[name], scope);
      }
    }
    importers[id] = output;
  }
  const packages: Record<string, PackageSnapshot> = {};
  for (const variant of variants.values()) {
    const { source, snapshot, sourceKey } = variant;
    const output: Fields = { ...source };
    for (const field of graphFields) delete output[field];
    delete output.integrity;
    const resolution = { ...source.resolution };
    if (source.integrity !== undefined && resolution.integrity === undefined)
      resolution.integrity = source.integrity;
    if (
      Object.keys(resolution).length === 0 &&
      aliasParts(sourceKey).version.startsWith('file:')
    ) {
      resolution.directory = aliasParts(sourceKey).version.slice(5);
      resolution.type = 'directory';
    }
    output.resolution = resolution;
    const peers: Record<string, string> = {};
    const peerMeta: Fields = {};
    for (const [name, peer] of Object.entries(source.peerDependencies ?? {})) {
      if (typeof peer === 'string') peers[name] = peer;
      else {
        if (peer.specifier !== undefined) peers[name] = peer.specifier;
        if (peer.optional !== undefined)
          peerMeta[name] = { optional: peer.optional };
      }
    }
    if (Object.keys(peers).length) output.peerDependencies = peers;
    if (Object.keys(peerMeta).length) output.peerDependenciesMeta = peerMeta;
    const scope: Bindings = {
      ...variant.bindings,
      ...snapshot.optionalDependencies,
      ...snapshot.dependencies,
    };
    for (const field of ['dependencies', 'optionalDependencies'] as const) {
      if (snapshot[field])
        output[field] = Object.fromEntries(
          Object.entries(snapshot[field]).map(([name, ref]) => [
            name,
            normalizeRef(name, ref, scope, sourceKey),
          ])
        );
    }
    for (const [name, peer] of Object.entries(
      snapshot.peerDependencies ?? {}
    )) {
      if (typeof peer === 'string' || peer.version === undefined || peer.below)
        continue;
      const field =
        peer.optional || (isObject(peerMeta[name]) && peerMeta[name].optional)
          ? 'optionalDependencies'
          : 'dependencies';
      const deps = (output[field] ??= {}) as Record<string, string>;
      deps[name] ??= normalizeRef(
        name,
        {
          version: peer.version,
          ...(peer.with === undefined ? {} : { with: peer.with }),
        },
        scope,
        sourceKey
      );
    }
    const transitive = Object.entries(snapshot.peerDependencies ?? {})
      .filter(
        ([, peer]) =>
          typeof peer !== 'string' && peer.below && peer.version !== undefined
      )
      .map(([name]) => name);
    if (transitive.length || snapshot.unboundPeerDependencies?.length)
      output.transitivePeerDependencies = [
        ...new Set([
          ...transitive,
          ...(snapshot.unboundPeerDependencies ?? []),
        ]),
      ];
    if (snapshot.optional) output.optional = true;
    if (snapshot.id !== undefined) output.id = snapshot.id;
    variant.normalized = structuredClone(output) as unknown as PackageSnapshot;
    Object.assign(output, { [packageMetadata]: variant });
    packages[variant.key] = output as unknown as PackageSnapshot;
  }
  const output: Fields = { ...raw, ...lifted, settings, importers, packages };
  delete output.projects;
  delete output.snapshots;
  const result = output as unknown as Normalized;
  result[metadata] = {
    variants,
    importers: resolvedImporters,
    normalizedImporters: structuredClone(importers),
  };
  return result;
}

/**
 * Nx's graph coalesces peer variants into one package/version node. The
 * generic root-snapshot builder therefore picks the first variant. Recover
 * the original project's references when its complete dependency set matches
 * the constructed importer, without guessing across unrelated project scopes.
 */
export function selectPnpmLockfileV13ImporterReferences(
  lockfile: Lockfile,
  importer: ProjectSnapshot
): void {
  const state = (lockfile as Normalized)[metadata];
  if (!state || !isPnpmLockfileV13(lockfile)) return;
  const output = dependencyFields.flatMap((field) =>
    Object.entries(importer[field] ?? {}).map(([name, ref]) => ({
      field,
      name,
      ref,
    }))
  );
  if (!output.length) return;
  const baseKey = (name: string, ref: string) => {
    const key = referenceKey(name, ref);
    return state.variants.get(key)?.sourceKey ?? key;
  };
  let selected: { id: string; refs: string[]; extras: number } | undefined;
  for (const [id, candidate] of Object.entries(state.normalizedImporters)) {
    const refs: string[] = [];
    for (const { field, name, ref } of output) {
      // Deployment can promote a peer into dependencies. Prefer the original
      // section, then inspect the other sections the v13 importer can contain.
      const sections = [
        field,
        ...dependencyFields.filter((other) => other !== field),
      ];
      const found = sections
        .map((section) => candidate[section]?.[name])
        .find(
          (source) =>
            source !== undefined && baseKey(name, source) === baseKey(name, ref)
        );
      if (found === undefined) break;
      refs.push(found);
    }
    if (refs.length !== output.length) continue;
    const extras =
      dependencyFields.reduce(
        (count, field) => count + Object.keys(candidate[field] ?? {}).length,
        0
      ) - output.length;
    if (!selected || extras < selected.extras) selected = { id, refs, extras };
  }
  if (!selected) return;
  for (let i = 0; i < output.length; i++) {
    const { field, name } = output[i];
    importer[field]![name] = selected.refs[i];
  }
  Object.assign(importer, { [importerMetadata]: state.importers[selected.id] });
}

/** Rebuild the v13 wire document from the packages/importers surviving pruning. */
export function stringifyPnpmLockfileV13(lockfile: Lockfile): PnpmLockfileV13 {
  const state = (lockfile as Normalized)[metadata];
  if (!state)
    throw new Error(
      'Cannot write pnpm v13 without its normalized binding metadata'
    );
  const currentVariants = new Map<string, Variant>();
  const currentKeys = new Map<Variant, string>();
  const relocated = new Map<string, string>();
  for (const [key, pkg] of Object.entries(lockfile.packages ?? {})) {
    const variant =
      (pkg as PackageSnapshot & { [packageMetadata]?: Variant })[
        packageMetadata
      ] ?? state.variants.get(key);
    if (!variant) continue;
    currentVariants.set(key, variant);
    currentKeys.set(variant, key.replace(/\(nx-v13-\d+\)$/, ''));
    relocated.set(variant.sourceKey, key.replace(/\(nx-v13-\d+\)$/, ''));
    for (const field of ['dependencies', 'optionalDependencies'] as const) {
      for (const [name, before] of Object.entries(
        variant.normalized?.[field] ?? {}
      )) {
        const after = pkg[field]?.[name];
        if (after !== undefined && before !== after)
          relocated.set(referenceKey(name, before), referenceKey(name, after));
      }
    }
  }
  const relocateRef = (name: string, reference: Reference): Reference => {
    const before = referenceKey(name, reference);
    const version = referenceFor(name, relocated.get(before) ?? before);
    if (typeof reference === 'string' || reference.with === undefined)
      return version;
    return {
      version,
      with: Object.fromEntries(
        Object.entries(reference.with).map(([peer, binding]) => [
          peer,
          relocateRef(peer, binding),
        ])
      ),
    };
  };
  const emitRef = (
    name: string,
    ref: string,
    original?: Reference
  ): Reference => {
    const selected = currentVariants.get(referenceKey(name, ref));
    if (!selected) return ref;
    const version = referenceFor(name, currentKeys.get(selected)!);
    const bindings = selected.bindings;
    // Standalone pruning changes provider scope. Spell out the selected
    // bindings, retaining finite nested discriminators rather than expanding
    // the provider graph (which can be cyclic).
    const originalWith =
      typeof original === 'string' ? undefined : original?.with;
    const reusable =
      originalWith !== undefined &&
      Object.entries(originalWith).every(
        ([peer, wanted]) =>
          bindings[peer] !== undefined &&
          sameNamedBinding(wanted, bindings[peer])
      );
    const chosen = reusable
      ? originalWith
      : Object.keys(bindings).length
        ? bindings
        : undefined;
    return chosen === undefined
      ? version
      : {
          version,
          with: Object.fromEntries(
            Object.entries(chosen).map(([peer, binding]) => [
              peer,
              relocateRef(peer, binding),
            ])
          ),
        };
  };
  const projects: Record<string, Importer> = {};
  for (const [id, importer] of Object.entries(lockfile.importers)) {
    const result = { ...importer } as unknown as Importer;
    delete result.specifiers;
    delete (result as Importer & { [importerMetadata]?: Importer })[
      importerMetadata
    ];
    const sourceImporter =
      (importer as ProjectSnapshot & { [importerMetadata]?: Importer })[
        importerMetadata
      ] ?? state.importers[id];
    for (const field of dependencyFields) {
      if (!importer[field]) continue;
      result[field] = {};
      for (const [name, ref] of Object.entries(importer[field])) {
        const original =
          sourceImporter?.[field]?.[name] ??
          dependencyFields
            .map((section) => sourceImporter?.[section]?.[name])
            .find((entry) => entry !== undefined);
        const dep = typeof original === 'string' ? undefined : original;
        const reference = emitRef(
          name,
          ref,
          dep?.version
            ? {
                version: dep.version,
                ...(dep.with === undefined ? {} : { with: dep.with }),
              }
            : undefined
        );
        result[field][name] = {
          specifier: importer.specifiers?.[name] ?? ref,
          ...(typeof reference === 'string'
            ? { version: reference }
            : reference),
        };
      }
    }
    projects[id] = result;
  }
  const groups = new Map<string, { source: Package; snapshots: Snapshot[] }>();
  const packages: Record<string, Package> = {};
  for (const [key, pkg] of Object.entries(lockfile.packages ?? {})) {
    const variant = currentVariants.get(key);
    if (!variant) {
      const synthetic = { ...pkg } as unknown as Package;
      for (const field of ['dependencies', 'optionalDependencies'] as const) {
        if (pkg[field])
          synthetic[field] = Object.fromEntries(
            Object.entries(pkg[field]).map(([name, ref]) => [
              name,
              emitRef(name, ref),
            ])
          );
      }
      packages[key] = synthetic;
      continue;
    }
    const currentKey = currentKeys.get(variant)!;
    let group = groups.get(currentKey);
    if (!group) {
      const source = { ...variant.source };
      for (const field of graphFields) delete source[field];
      // Metadata remains raw: integrity, specifiers and non-registry resolution
      // retain their v13 representation instead of leaking normalized fields.
      if (stable(pkg.resolution) !== stable(variant.normalized?.resolution)) {
        source.resolution = { ...pkg.resolution };
        if (source.resolution.integrity !== undefined) {
          source.integrity = String(source.resolution.integrity);
          delete source.resolution.integrity;
        }
      }
      const declarations = declaredPeers(variant.source.peerDependencies);
      if (Object.keys(declarations).length)
        source.peerDependencies = declarations;
      group = { source, snapshots: [] };
      groups.set(currentKey, group);
    }
    const snapshot: Snapshot = {};
    const peers = structuredClone(variant.snapshot.peerDependencies ?? {});
    for (const [name, peer] of Object.entries(peers)) {
      if (typeof peer === 'string' || peer.version === undefined) continue;
      const reference = relocateRef(name, {
        version: peer.version,
        ...(peer.with === undefined ? {} : { with: peer.with }),
      });
      peers[name] = {
        ...peer,
        ...(typeof reference === 'string' ? { version: reference } : reference),
      };
    }
    for (const field of ['dependencies', 'optionalDependencies'] as const) {
      const deps: Record<string, Reference> = {};
      for (const [name, ref] of Object.entries(pkg[field] ?? {})) {
        const peer = peers[name];
        const ownDependency =
          variant.snapshot.dependencies?.[name] !== undefined ||
          variant.snapshot.optionalDependencies?.[name] !== undefined;
        if (
          !ownDependency &&
          typeof peer !== 'string' &&
          peer?.version !== undefined &&
          !peer.below
        ) {
          const emitted = emitRef(name, ref, {
            version: peer.version,
            ...(peer.with === undefined ? {} : { with: peer.with }),
          });
          peers[name] = {
            ...peer,
            ...(typeof emitted === 'string' ? { version: emitted } : emitted),
          };
        } else deps[name] = emitRef(name, ref, variant.snapshot[field]?.[name]);
      }
      if (Object.keys(deps).length) snapshot[field] = deps;
    }
    if (Object.keys(peers).length) snapshot.peerDependencies = peers;
    if (variant.snapshot.unboundPeerDependencies !== undefined)
      snapshot.unboundPeerDependencies =
        variant.snapshot.unboundPeerDependencies;
    if (pkg.optional) snapshot.optional = true;
    if (pkg.id !== undefined) snapshot.id = pkg.id;
    group.snapshots.push(snapshot);
  }
  for (const [key, { source, snapshots }] of groups) {
    packages[key] =
      snapshots.length === 1
        ? { ...source, ...snapshots[0] }
        : { ...source, snapshots };
  }
  const result = {
    ...lockfile,
    lockfileVersion: '13.0',
    projects,
    packages,
  } as unknown as PnpmLockfileV13;
  delete (result as unknown as Normalized)[metadata];
  delete result.importers;
  delete result.snapshots;
  const settings = { ...((lockfile.settings ?? {}) as Fields) };
  for (const field of settingSections) {
    if (Object.hasOwn(lockfile, field))
      settings[field] = (lockfile as unknown as Fields)[field];
    delete result[field];
  }
  if (Object.keys(settings).length) result.settings = settings;
  else delete result.settings;
  return result;
}

function isObject(value: unknown): value is Fields {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function refVersion(ref: Reference): string {
  return typeof ref === 'string' ? ref : ref.version;
}
function aliasParts(reference: string): { name?: string; version: string } {
  const at = reference.indexOf('@', reference.startsWith('@') ? 1 : 0);
  const colon = reference.indexOf(':');
  if (at < 0 || (colon >= 0 && colon < at)) return { version: reference };
  return { name: reference.slice(0, at), version: reference.slice(at + 1) };
}
function referenceKey(name: string, reference: Reference): string {
  const version = refVersion(reference);
  if (version.startsWith('link:')) return version;
  const parts = aliasParts(version);
  return parts.name ? version : `${name}@${version}`;
}
function referenceFor(name: string, key: string): string {
  return key.startsWith(`${name}@`) ? key.slice(name.length + 1) : key;
}
function peerBindings(peers: Snapshot['peerDependencies']): Bindings {
  return Object.fromEntries(
    Object.entries(peers ?? {})
      .filter(
        ([, peer]) => typeof peer !== 'string' && peer.version !== undefined
      )
      .map(([name, peer]) => {
        const detailed = peer as Exclude<Peer, string>;
        return [
          name,
          detailed.with === undefined
            ? detailed.version!
            : { version: detailed.version!, with: detailed.with },
        ];
      })
  );
}
function sameNamedBinding(wanted: Reference, actual: Reference): boolean {
  if (refVersion(wanted) !== refVersion(actual)) return false;
  if (typeof wanted === 'string' || wanted.with === undefined) return true;
  const actualBindings = typeof actual === 'string' ? {} : (actual.with ?? {});
  return stable(wanted.with) === stable(actualBindings);
}
function stable(value: unknown): string {
  if (!isObject(value)) return JSON.stringify(value);
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stable(value[key])])
    )
  );
}

function mergePeers(
  shared: Snapshot['peerDependencies'],
  snapshot: Snapshot['peerDependencies']
): Record<string, Peer> {
  const result: Record<string, Peer> = { ...snapshot };
  for (const [name, peer] of Object.entries(shared ?? {})) {
    const own = result[name];
    const declaration = typeof peer === 'string' ? { specifier: peer } : peer;
    const binding = typeof own === 'string' ? { specifier: own } : own;
    result[name] = own === undefined ? peer : { ...binding, ...declaration };
  }
  return result;
}
function declaredPeers(
  peers: Snapshot['peerDependencies']
): Record<string, Peer> {
  const result: Record<string, Peer> = {};
  for (const [name, peer] of Object.entries(peers ?? {})) {
    if (typeof peer === 'string') result[name] = peer;
    else if (peer.specifier !== undefined || peer.optional !== undefined) {
      result[name] = {
        ...(peer.specifier === undefined ? {} : { specifier: peer.specifier }),
        ...(peer.optional === undefined ? {} : { optional: peer.optional }),
      };
    }
  }
  return result;
}
