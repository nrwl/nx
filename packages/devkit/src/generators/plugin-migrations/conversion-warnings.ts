/**
 * Warning messages the inline hoist (`executor-to-plugin-migrator`) and the
 * batch finalize (`batch-conversion-finalize`) emit for the same outcomes. One
 * builder per message so both paths stay word for word identical.
 */

/** Which package.json signal authors a target's identity. */
export type PackageJsonIdentitySource = 'script' | 'nxTargets' | 'unparseable';

/** A migrated target was left untouched because package.json authors its identity. */
export function keptPreMigrationTargetWarning(
  targetName: string,
  projectName: string,
  source: PackageJsonIdentitySource
): string {
  const cause = {
    script: `an included package.json script named "${targetName}" would replace the inferred target with nx:run-script once the explicit executor is removed. Rename or exclude the script`,
    nxTargets: `the package.json nx.targets entry for "${targetName}" (next to project.json) would replace the inferred target once the explicit executor is removed. Remove that entry`,
    unparseable: `its package.json could not be parsed, so a same-name script that would replace the inferred target cannot be ruled out. Fix the file`,
  }[source];
  return `convert-to-inferred kept the pre-migration configuration of target "${targetName}" in project "${projectName}": ${cause}, then rerun the migration to convert it. The target keeps the same behavior as before the migration.`;
}

function withCauses(errors: string[]): string {
  return errors.length > 0
    ? ` The verification pass reported errors: ${errors.join('; ')}`
    : '';
}

/** A target's centralization was skipped before writing anything. */
export function retainedResidualsWarning(
  targetNames: string[],
  reason: string
): string {
  return `convert-to-inferred retained full per-project configuration for target(s) ${targetNames.join(
    ', '
  )} because ${reason}; no configuration was lost, but shared configuration remains duplicated.`;
}

/** Projects whose target identity lives outside the plugin were not hoisted. */
export function excludedProjectsWarning(
  projectNames: string[],
  targetNames: string[]
): string {
  return `convert-to-inferred kept per-project configuration for ${
    projectNames.length
  } project(s) (${projectNames.join(', ')}) on target(s) ${targetNames.join(
    ', '
  )} instead of centralizing it: their target identity is authored outside the plugin (a project.json executor/command, or a package.json script/nx.targets entry), so a plugin-scoped default would not resolve for them. Those projects keep their full per-project configuration; review them if you expected shared configuration.`;
}

/** A hoisted target was reverted because it reached a non-migrated root. */
export function revertedTargetsWarning(
  targetNames: string[],
  errors: string[]
): string {
  return `convert-to-inferred kept per-project configuration for target(s) ${targetNames.join(
    ', '
  )} instead of centralizing it: other projects inferred by this plugin would have inherited the centralized configuration (or the verification pass could not confirm they would not). The migrated projects keep the same output as before centralization.${withCauses(
    errors
  )}`;
}

/** Pairs whose post-migration output could not be verified as equivalent. */
export function unverifiedPairsWarning(
  fallbacks: string[],
  errors: string[]
): string {
  return `convert-to-inferred restored the pre-centralization migration output for ${
    fallbacks.length
  } target(s) that could not be verified as equivalent after migration: ${fallbacks.join(
    ', '
  )}. Centralized nx.json defaults are shadowed where their keys overlap, but the live inferred configuration may differ from the pre-migration behavior. Review these targets manually.${withCauses(
    errors
  )}`;
}

/** Verification errors that neither a revert nor a fallback warning carried. */
export function verificationErrorsWarning(
  errors: string[],
  anyFallback: boolean
): string {
  const outcome = anyFallback
    ? ' Review any workspace configuration the errors reference.'
    : ' The migrated targets matched their pre-migration output, but review any workspace configuration the errors reference.';
  return `convert-to-inferred could not fully verify the migration: the verification inference pass reported errors: ${errors.join(
    '; '
  )}.${outcome}`;
}
