#!/usr/bin/env node
// Every nested .oxlintrc.json that redefines `no-restricted-imports` replaces
// the root rule's options wholesale (oxlint does not merge them), and a missing
// entry fails silently — fewer errors, not more. This asserts each redefinition
// still carries every root path and pattern, minus the allowlisted exceptions.

const { execSync } = require('child_process');
const { readFileSync } = require('fs');
const { parse } = require('jsonc-parser');

const RULE = 'no-restricted-imports';

const NX_BOUNDARY = ['nx', 'nx/**', '!nx/release', '!nx/release/**'];
const JS_PLUGINS = ['nx/src/plugins/js*', 'nx/src/plugins/js*/**'];
const NATIVE_BINDINGS = ['**/native-bindings', '**/native-bindings.js'];
const BASE_PATHS = ['create-nx-workspace', 'node-fetch'];

// Non-published projects (and the create-* CLIs) that legitimately reach into
// nx internals: the allowDirectNxImports escape hatch from the ESLint days.
const DIRECT_NX_IMPORTS_HATCH = [
  'astro-docs/.oxlintrc.json',
  'e2e/angular/.oxlintrc.json',
  'e2e/nx-init/.oxlintrc.json',
  'e2e/nx/.oxlintrc.json',
  'e2e/plugin/.oxlintrc.json',
  'e2e/react/.oxlintrc.json',
  'e2e/release/.oxlintrc.json',
  'e2e/utils/.oxlintrc.json',
  'graph/client/.oxlintrc.json',
  'graph/migrate/.oxlintrc.json',
  'graph/project-details/.oxlintrc.json',
  'graph/shared/.oxlintrc.json',
  'graph/ui-common/.oxlintrc.json',
  'graph/ui-project-details/.oxlintrc.json',
  'packages/create-nx-workspace/.oxlintrc.json',
];

// config path -> root entries it deliberately omits, with the reason.
// `omits` applies to every redefinition in the file; `overrides` is keyed by
// an override's `files` list for omissions specific to that override.
const ALLOWED_OMISSIONS = {
  ...Object.fromEntries(
    DIRECT_NX_IMPORTS_HATCH.map((path) => [path, { omits: NX_BOUNDARY }])
  ),
  // Wraps create-nx-workspace, so it imports it.
  'packages/create-nx-plugin/.oxlintrc.json': {
    omits: [...NX_BOUNDARY, 'create-nx-workspace'],
  },
  // Its own nx/bin/*, nx/src/* and nx/plugins/* groups are broader than the
  // root's js-plugin, native-bindings and boundary entries.
  'packages/devkit/.oxlintrc.json': {
    omits: [...NX_BOUNDARY, ...JS_PLUGINS, ...NATIVE_BINDINGS],
  },
  // The package itself: the circular-import group covers nx/* for .ts files
  // and spec files use the hatch. nxw.ts allows node builtins only, which is
  // broader than every root entry.
  'packages/nx/.oxlintrc.json': {
    omits: [...NX_BOUNDARY, ...JS_PLUGINS],
    overrides: { 'nxw.ts': [...NATIVE_BINDINGS, ...BASE_PATHS] },
  },
  // plugins/with-nx.ts ships inside next.config: its "nothing from nx, @nx or
  // relative files" groups are broader than the root patterns.
  'packages/next/.oxlintrc.json': {
    overrides: {
      'plugins/with-nx.ts': [...NX_BOUNDARY, ...JS_PLUGINS, ...NATIVE_BINDINGS],
    },
  },
};

function readConfig(path) {
  return parse(readFileSync(path, 'utf-8'));
}

function ruleEntries(ruleConfig) {
  if (!Array.isArray(ruleConfig) || typeof ruleConfig[1] !== 'object') {
    return null; // "off"/"error" without options: explicit, not a silent narrowing
  }
  const options = ruleConfig[1];
  const paths = (options.paths ?? []).map((p) =>
    typeof p === 'string' ? p : p.name
  );
  const patterns = (options.patterns ?? []).flatMap((p) =>
    typeof p === 'string' ? [p] : (p.group ?? [])
  );
  return { paths, patterns };
}

function redefinitions(config) {
  const found = [];
  if (config.rules?.[RULE]) {
    found.push({ where: 'rules', entries: ruleEntries(config.rules[RULE]) });
  }
  (config.overrides ?? []).forEach((override, i) => {
    if (override.rules?.[RULE]) {
      const files = (override.files ?? []).join(', ');
      found.push({
        where: `overrides[${i}] (${files})`,
        files,
        entries: ruleEntries(override.rules[RULE]),
      });
    }
  });
  return found.filter((f) => f.entries);
}

const root = ruleEntries(readConfig('.oxlintrc.json').rules[RULE]);
const configs = execSync("git ls-files '*/.oxlintrc.json'", {
  encoding: 'utf-8',
})
  .split('\n')
  .filter((f) => f && !f.startsWith('examples/'));

const failures = [];
// Every allowance must excuse a real omission somewhere, or it is stale.
const unusedAllowances = new Set();
for (const [configPath, allowance] of Object.entries(ALLOWED_OMISSIONS)) {
  for (const key of Object.keys(allowance)) {
    if (key !== 'omits' && key !== 'overrides') {
      failures.push(`unknown allowance key "${key}" for ${configPath}`);
    }
  }
  for (const entry of allowance.omits ?? []) {
    unusedAllowances.add(`${configPath}: ${entry}`);
  }
  for (const [files, entries] of Object.entries(allowance.overrides ?? {})) {
    for (const entry of entries) {
      unusedAllowances.add(`${configPath} (${files}): ${entry}`);
    }
  }
}
for (const configPath of configs) {
  const allowance = ALLOWED_OMISSIONS[configPath];
  for (const { where, files, entries } of redefinitions(
    readConfig(configPath)
  )) {
    const omitted = [
      ...root.paths.filter((p) => !entries.paths.includes(p)),
      ...root.patterns.filter((p) => !entries.patterns.includes(p)),
    ];
    const missing = omitted.filter((entry) => {
      if (allowance?.omits?.includes(entry)) {
        unusedAllowances.delete(`${configPath}: ${entry}`);
        return false;
      }
      if (files && allowance?.overrides?.[files]?.includes(entry)) {
        unusedAllowances.delete(`${configPath} (${files}): ${entry}`);
        return false;
      }
      return true;
    });
    if (missing.length) {
      failures.push(`${configPath} ${where} is missing: ${missing.join(', ')}`);
    }
  }
}
for (const stale of unusedAllowances) {
  failures.push(`allowance no longer needed: ${stale}`);
}

if (failures.length) {
  console.error(
    `${RULE} coverage check failed (restate the entry, or fix the allowlist in scripts/check-oxlint-configs.js):\n\n` +
      failures.map((f) => `  - ${f}`).join('\n')
  );
  process.exit(1);
}
console.log(
  `${configs.length} nested oxlint configs cover the root ${RULE} entries.`
);
