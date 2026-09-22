/**
 * Whether `nx affected` selects the individual tasks whose inputs a change
 * reaches, rather than whole projects. Off by default while the task path
 * settles.
 *
 * Env-var only, so `nx show projects --affected -t build` and
 * `nx affected -t build` in one CI script agree on what is affected. The run
 * also executes the dependencies those tasks need, so it runs more than the
 * list names.
 */
export function selectsAffectedTasks(): boolean {
  return process.env.NX_LEGACY_AFFECTED === 'false';
}
