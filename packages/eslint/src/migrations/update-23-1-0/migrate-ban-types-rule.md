# Migrate the removed `@typescript-eslint/ban-types` rule

typescript-eslint v8 removed `@typescript-eslint/ban-types`, so an ESLint flat
config that still references it fails to load. It was split into three rules:

- `@typescript-eslint/no-empty-object-type` - the `{}` type
- `@typescript-eslint/no-unsafe-function-type` - the `Function` type
- `@typescript-eslint/no-wrapper-object-types` - wrapper types (`String`, `Number`, `Boolean`, `Object`, ...)

In every ESLint flat config (`eslint.config.{mjs,cjs,js,cts,ts,mts}`) that sets
`@typescript-eslint/ban-types`, replace that single entry with the three rules
above. The options do not map 1:1: if the old entry was just `'error'`/`'warn'`,
set all three to that level; if it customized `types`/`extendDefaults`, translate
the intent to whichever successor rule covers each banned type and drop anything
with no equivalent. Then run `nx run-many -t lint` and confirm the configs load.
