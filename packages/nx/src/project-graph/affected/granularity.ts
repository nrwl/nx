export type AffectedGranularity = 'project' | 'task';

/**
 * Task granularity is opt-in while it is being trialled, and env-var only so
 * the trial leaves no config behind. An `nx.json` key would have to be
 * migrated away once this becomes the default.
 *
 * Not a CLI flag: a CI script that builds a list with
 * `nx show projects --affected -t build` and then runs `nx affected -t build`
 * needs both to agree, and an env var covers the whole script.
 */
export function resolveAffectedGranularity(): AffectedGranularity {
  return process.env.NX_AFFECTED_GRANULARITY === 'task' ? 'task' : 'project';
}
