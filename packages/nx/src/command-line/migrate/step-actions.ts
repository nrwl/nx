// Zero-dep source of truth for --step-action: keeps migrate/run's execution
// chain out of CLI startup for callers that only need the value list or type.

/** Allowed values for `--step-action`, the orchestrated reconcile's decision relay. */
export const STEP_ACTIONS = ['retry', 'skip', 'retry-clean', 'adopt'] as const;

export type StepAction = (typeof STEP_ACTIONS)[number];

/** Runtime guard backed by {@link STEP_ACTIONS} so the two can't drift apart. */
export function isStepAction(value: unknown): value is StepAction {
  return (STEP_ACTIONS as readonly unknown[]).includes(value);
}
