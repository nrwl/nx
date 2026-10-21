Structured return value for a migration function.

- `nextSteps`: workspace-wide notes surfaced to the human in the `nx migrate`
  post-run summary. Same audience as the legacy `string[]` return.
- `agentContext`: agent-only by contract. With the agentic flow on it is
  delivered to the agent as part of its outer prompt, but only when the step
  it feeds actually runs: a hybrid's paired prompt, or the validation pass
  after a generator-only migration, which also needs file changes and no
  `--no-validate`. When `nx migrate` itself runs inside an outer agent it goes
  to stdout for that agent instead. Anything else drops it, so content meant
  for the human in any scenario belongs in `nextSteps`.
- `skipAgentic`: set to `true` to declare that the deterministic run handled
  everything, so `nx migrate` skips the AI step it would otherwise run: the
  paired prompt of a hybrid migration, or the generic validation step of a
  generator-only one. Omitting it keeps the AI step, so this is opt-in.
  Where the waiver takes effect, `agentContext` is dropped along with the
  step it was meant for.

## Table of contents

### Properties

- [agentContext](/docs/reference/devkit/MigrationReturnObject#agentcontext)
- [nextSteps](/docs/reference/devkit/MigrationReturnObject#nextsteps)
- [skipAgentic](/docs/reference/devkit/MigrationReturnObject#skipagentic)

## Properties

### agentContext

• `Optional` **agentContext**: `string`[]

___

### nextSteps

• `Optional` **nextSteps**: `string`[]

___

### skipAgentic

• `Optional` **skipAgentic**: `boolean`
