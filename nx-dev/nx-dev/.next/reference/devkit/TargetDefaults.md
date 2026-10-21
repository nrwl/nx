Ƭ **TargetDefaults**: `Record`\<`string`, [`TargetDefaultValue`](/docs/reference/devkit/TargetDefaultValue)\>

`targetDefaults` is a map keyed by logical target name (`build`, `test`),
glob (`e2e-ci--*`), or executor (`@nx/js:tsc`). Each value is either a plain
config object or an ordered array of filtered entries — see
[TargetDefaultValue](/docs/reference/devkit/TargetDefaultValue). The map shape is additive: existing record-shaped
configs remain valid because every value is allowed to be a bare object.
