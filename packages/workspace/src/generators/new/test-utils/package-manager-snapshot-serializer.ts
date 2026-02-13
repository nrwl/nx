/**
 * Jest snapshot serializer that normalizes packageManager versions.
 * Replaces version numbers like "npm@11.6.1" with "npm@<version>" to prevent
 * snapshot failures when local/CI package manager versions differ.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const packageManagerSnapshotSerializer: any = {
  serialize(val, config, indentation, depth, refs, printer) {
    const normalized = {
      ...val,
      packageManager: val.packageManager.replace(
        /^(npm|pnpm|yarn|bun)@[\d.]+$/,
        '$1@<version>'
      ),
    };
    return printer(normalized, config, indentation, depth, refs);
  },
  test(val) {
    return (
      val != null &&
      typeof val === 'object' &&
      'packageManager' in val &&
      typeof val.packageManager === 'string' &&
      /^(npm|pnpm|yarn|bun)@[\d.]+$/.test(val.packageManager)
    );
  },
};
