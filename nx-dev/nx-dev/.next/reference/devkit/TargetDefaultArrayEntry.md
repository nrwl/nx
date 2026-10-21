Ƭ **TargetDefaultArrayEntry**: \{ `filter?`: [`TargetDefaultFilter`](/docs/reference/devkit/TargetDefaultFilter)  } & `Partial`\<[`TargetConfiguration`](/docs/reference/devkit/TargetConfiguration)\>

A single entry in the array-shaped value of a `targetDefaults` key.
Carries an optional [TargetDefaultFilter](/docs/reference/devkit/TargetDefaultFilter) alongside the
`TargetConfiguration` fields that get applied when the filter matches.

Within a key's array, entries apply in document order, last match winning.
