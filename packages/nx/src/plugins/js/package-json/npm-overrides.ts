import { intersects, validRange } from 'semver';
import type {
  PackageJson,
  PackageJsonDependencySection,
} from '../../../utils/package-json';
import { parseNpmAlias } from '../lock-file/utils/package-json';

type NpmOverrides = PackageJson['overrides'];

type NpmOverrideRule = {
  key: string;
  // the spec npm installs in place of the dependency's own, `*` for none
  value: string;
};

const DEPENDENCY_SECTIONS: PackageJsonDependencySection[] = [
  'dependencies',
  'optionalDependencies',
  'devDependencies',
  'peerDependencies',
];

// npm's OverrideSet.getEdgeRule: the first rule for the name whose key range,
// `*` when absent, intersects the spec; a spec that isn't a range matches any.
function findNpmOverrideRule(
  overrides: NpmOverrides,
  name: string,
  spec: string
): NpmOverrideRule | undefined {
  for (const [key, override] of Object.entries(overrides)) {
    const at = key.indexOf('@', 1);
    if ((at === -1 ? key : key.slice(0, at)) !== name) {
      continue;
    }
    const keySpec = at === -1 ? '*' : key.slice(at + 1) || '*';
    const range = parseNpmAlias(spec)?.range ?? spec;
    if (keySpec !== '*' && validRange(range) && !intersects(range, keySpec)) {
      continue;
    }
    // npm reads an empty value as `*`, and an object without `.` as the key
    const own = typeof override === 'string' ? override : override['.'];
    return { key, value: typeof own === 'string' ? own || '*' : keySpec };
  }
  return undefined;
}

/** The root's `$name` references resolved in npm's lookup order. */
export function resolveNpmOverrideReferences(
  overrides: NpmOverrides,
  rootPackageJson: PackageJson
): NpmOverrides {
  const resolve = (value: string | NpmOverrides) => {
    if (typeof value === 'string') {
      const name = value.startsWith('$') ? value.slice(1) : undefined;
      return (
        (name &&
          (rootPackageJson.devDependencies?.[name] ||
            rootPackageJson.optionalDependencies?.[name] ||
            rootPackageJson.dependencies?.[name] ||
            rootPackageJson.peerDependencies?.[name])) ||
        value
      );
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, resolve(nested)])
    );
  };
  return resolve(overrides) as NpmOverrides;
}

/**
 * Gives each direct dependency the spec its override sets, since npm rejects a
 * rule that changes a root dependency's spec (EOVERRIDE).
 */
export function applyNpmOverridesToDependencies(
  packageJson: PackageJson,
  overrides: NpmOverrides
): void {
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, spec] of Object.entries(packageJson[section] ?? {})) {
      const rule = findNpmOverrideRule(overrides, name, spec);
      if (!rule || rule.value === '*') {
        continue;
      }
      const conflict = findNpmOverrideRule(overrides, name, rule.value);
      if (conflict && conflict.value !== '*' && conflict.value !== rule.value) {
        throw new Error(
          `The root override "${rule.key}" resolves the ${section} entry ${name}@${spec} to ${rule.value}. In the pruned output ${name}@${rule.value} is a direct dependency that the override "${conflict.key}" changes to ${conflict.value}, which npm rejects (EOVERRIDE). Narrow "${conflict.key}" so it does not match ${rule.value}.`
        );
      }
      packageJson[section][name] = rule.value;
    }
  }
}

/**
 * Drops the version a rule sets for a direct dependency, which npm rejects
 * (EOVERRIDE); the rules it sets for the dependency's own dependencies stay.
 */
export function dropNpmOverridesOfDirectDependencies(
  overrides: NpmOverrides,
  packageJson: PackageJson
): NpmOverrides {
  const result = { ...overrides };
  for (const section of DEPENDENCY_SECTIONS) {
    for (const [name, spec] of Object.entries(packageJson[section] ?? {})) {
      for (
        let rule = findNpmOverrideRule(result, name, spec);
        rule && ![spec, '*', `$${name}`].includes(rule.value);
        rule = findNpmOverrideRule(result, name, spec)
      ) {
        const override = result[rule.key];
        if (
          typeof override === 'object' &&
          '.' in override &&
          Object.keys(override).length > 1
        ) {
          const { '.': _, ...dependencies } = override;
          result[rule.key] = dependencies;
        } else {
          delete result[rule.key];
        }
      }
    }
  }
  return result;
}
