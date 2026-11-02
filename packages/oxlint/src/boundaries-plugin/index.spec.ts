import boundariesPlugin from './index.js';

/**
 * Checks the shape Oxlint expects of a JS plugin: the rule under its own key, a
 * schema, and a callable `create` — plus a `meta.name` that keeps the rule id
 * stable, which Oxlint does not require but which decides the namespace.
 *
 * Scope, so this isn't mistaken for more than it is: these run under jest, which
 * resolves `@nx/eslint-plugin/internal` through the `@nx/nx-source` condition to
 * TypeScript source, while Oxlint resolves it to the emitted `dist/internal.js`
 * and imports it across a CJS/ESM boundary. So the export *names* crossing that
 * boundary are not exercised here — `internal.spec.ts` in `@nx/eslint-plugin`
 * pins the emit shape they depend on.
 */
describe('@nx/oxlint/boundaries-plugin', () => {
  const ruleNames = ['enforce-module-boundaries', 'directive-checks'];
  const rule = (name: string) =>
    boundariesPlugin.rules[name] as {
      meta?: { name?: string; schema?: unknown };
      create?: unknown;
    };

  it.each(ruleNames)('exposes the %s rule under the @nx namespace', (name) => {
    // Without this Oxlint falls back to the package name, and the rule would
    // register as `@nx/oxlint/<rule>`, not the id the docs tell users to
    // configure.
    expect(boundariesPlugin.meta.name).toEqual('@nx');
    expect(Object.keys(boundariesPlugin.rules)).toContain(name);
  });

  it.each(ruleNames)(
    'carries the %s rule name in meta so the rule is self-describing',
    (name) => {
      // Oxlint itself takes the name from the rules key above, not from here.
      expect(rule(name).meta?.name).toEqual(name);
    }
  );

  it.each(ruleNames)(
    'keeps a schema for %s, without which Oxlint rejects the rule options',
    (name) => {
      expect(rule(name).meta?.schema).toBeDefined();
    }
  );

  it.each(ruleNames)(
    'exposes a create function for %s for Oxlint to call per file',
    (name) => {
      expect(typeof rule(name).create).toEqual('function');
    }
  );
});
