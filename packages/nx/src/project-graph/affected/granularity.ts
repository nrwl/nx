/**
 * Whether `nx affected` selects the individual tasks whose inputs a change
 * reaches. Off by default, where it selects whole projects instead, while the
 * task path settles.
 *
 * The default flips by flipping the comparison here, so both values stay
 * meaningful and a script that pinned either one keeps choosing what it asked
 * for.
 *
 * Env-var only, and not a CLI flag: a CI script that builds a list with
 * `nx show projects --affected -t build` and then runs `nx affected -t build`
 * needs both to agree, and an env var covers the whole script where a flag
 * would have to be repeated on each command.
 */
export function selectsAffectedTasks(): boolean {
  return process.env.NX_LEGACY_AFFECTED === 'false';
}
