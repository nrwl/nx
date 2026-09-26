/**
 * Config filenames Oxlint discovers on its own, in the order it declares them.
 * Two configs in the same directory is a hard error in Oxlint, so order here
 * only affects which one we report — not which one Oxlint uses.
 * See `apps/oxlint/src/lib.rs` in oxc-project/oxc.
 */
export const OXLINT_CONFIG_FILENAMES = [
  '.oxlintrc.json',
  '.oxlintrc.jsonc',
  'oxlint.config.ts',
  'oxlint.config.mts',
];
