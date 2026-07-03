/**
 * Expands `$VAR` / `${VAR}` references from `process.env`, matching nx-tools' `interpolate()`
 * behavior (falls back to the original text when the variable is unset/empty). Used for secret
 * values/paths and final build command args, so configs ported from `@nx-tools/nx-container`
 * (e.g. `secret-files: ["npmrc=$NPMRC_PATH"]`) keep working unmodified.
 */
export function interpolateEnvVar(value: string): string {
  return value.replace(
    /\${?([a-zA-Z0-9_]+)?}?/g,
    (match, name) => process.env[name] || match
  );
}
