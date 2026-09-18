export type AffectedGranularity = 'project' | 'task';

/**
 * Task granularity is the default. `NX_LEGACY_AFFECTED=true` falls back to
 * selecting whole projects, as an escape hatch while the task path settles.
 *
 * Env-var only, and not a CLI flag: a CI script that builds a list with
 * `nx show projects --affected -t build` and then runs `nx affected -t build`
 * needs both to agree, and an env var covers the whole script where a flag
 * would have to be repeated on each command.
 */
export function resolveAffectedGranularity(): AffectedGranularity {
  return process.env.NX_LEGACY_AFFECTED === 'true' ? 'project' : 'task';
}
