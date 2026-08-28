import { NxJsonConfiguration } from '../../config/nx-json';

export type AffectedGranularity = 'project' | 'task';

/**
 * Task granularity is opt-in while it is being trialled. Workspace-level rather
 * than a CLI flag, because a CI script that builds a list with
 * `nx show projects --affected -t build` and then runs `nx affected -t build`
 * needs both to agree.
 */
export function resolveAffectedGranularity(
  nxJson: NxJsonConfiguration
): AffectedGranularity {
  const override = process.env.NX_AFFECTED_GRANULARITY;
  if (override === 'project' || override === 'task') {
    return override;
  }
  return (nxJson.affected as any)?.granularity ?? 'project';
}
