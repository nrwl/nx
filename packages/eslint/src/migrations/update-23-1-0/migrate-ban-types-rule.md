# Migrate the removed `@typescript-eslint/ban-types` rule

typescript-eslint v8 removed `@typescript-eslint/ban-types`, so an ESLint flat
config that still references it fails to load. It was split into three rules:

- `@typescript-eslint/no-empty-object-type` - the `{}` type
- `@typescript-eslint/no-unsafe-function-type` - the `Function` type
- `@typescript-eslint/no-wrapper-object-types` - wrapper types (`String`, `Number`, `Boolean`, `Object`, ...)

## First, check whether there is anything to do

Confirm both conditions before changing anything. If either fails, make no
changes and stop:

1. Some ESLint flat config (`eslint.config.{mjs,cjs,js,cts,ts,mts}`) references
   `@typescript-eslint/ban-types`. Search the workspace for that string; if no
   config uses the rule, there is nothing to migrate.
2. The workspace is on typescript-eslint v8 or later (check `typescript-eslint`
   or `@typescript-eslint/eslint-plugin` in `package.json`). On v7 the rule
   still exists, so leave it untouched.

## Migrate

In every ESLint flat config (`eslint.config.{mjs,cjs,js,cts,ts,mts}`) that sets
`@typescript-eslint/ban-types`, replace that single entry with the three rules
above. The options do not map 1:1: if the old entry was just `'error'`/`'warn'`,
set all three to that level; if it customized `types`/`extendDefaults`, translate
the intent to whichever successor rule covers each banned type and drop anything
with no equivalent. Then run `nx run-many -t lint` and confirm the configs load.
