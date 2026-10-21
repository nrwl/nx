Ƭ **TargetDefaultValue**: `Partial`\<[`TargetConfiguration`](/docs/reference/devkit/TargetConfiguration)\> & \{ `filter?`: `never`  } \| [`TargetDefaultArrayEntry`](/docs/reference/devkit/TargetDefaultArrayEntry)[]

The value stored under a `targetDefaults` key. Either today's plain config
object (used when no filtering is needed) or an ordered array of filtered
entries (used once a key needs to vary defaults by plugin/projects/executor).

The two forms are equivalent for the unfiltered case: `{ cache: true }` and
`[{ cache: true }]` mean the same thing.

`filter` is only meaningful on array entries; the bare object form forbids it
(`filter?: never`) so a stray filter on the unfiltered form is a type error
rather than a silently-ignored field.
