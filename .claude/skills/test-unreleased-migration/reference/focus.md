# `--focus` selectors and resolution

Selector syntax and resolution for `--focus`, whose scope and two-tier report shape `SKILL.md`
step 8 defines. Omitting it puts everything in focus.

## Selectors

One `--focus` flag, comma-separated or repeatable. Each entry is one of:

| Selector                                  | Selects                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `<package>`                               | every migration in that package, e.g. `@nx/eslint`               |
| `<package>:<name>`                        | one migration, by the same id `nx migrate --run-migration` takes |
| `<package>:<name>@<version>`              | disambiguates a name reused across versions                      |
| `commit:<sha>` or `commit:<sha1>..<sha2>` | the migrations authored in that commit or range                  |

The `<package>:<name>` id is nx's own: `name` is the entry key in the package's authoring
`migrations.json`, and the split is on the **first** colon, so a name that itself contains a colon
still resolves. Use this spelling everywhere rather than inventing a second one; `--focus` and
`--run-migration` must be copy-pasteable between each other.

## Resolving `commit:`

Resolve to `(package, name)` tuples from two signals, and take the union:

1. **Collection entries.** Diff the commit or range against each package's `migrations.json`
   (`git diff <range> -- 'packages/*/migrations.json'`) and collect the entry keys added or changed.
   This is the authoritative signal, because the entry key is the id.
2. **Implementation files.** For each migration source file touched in the range, map it back to the
   entry whose `implementation`/`factory`/`prompt` points at it. Use `git log --follow -- <file>` per
   file when a rename needs tracing; `--follow` takes a single path, so do not pass it a directory.

Signal 2 catches a migration whose implementation changed without its collection entry moving.
Neither signal alone is complete, so do not require them to agree.

## Empty scope

If a repo subset or a `--focus` selector resolves to nothing (a `commit:` range that touched no
migration, a misspelled package), warn and `AskUserQuestion` whether to report against everything or
abort and retry with a corrected selector. Never silently render an empty result: an empty report
reads like a clean run.

## Deliberately not supported

Scoping to an authoring session. The only available link is the `Claude-Session:` commit trailer,
which is best-effort and absent on hand-authored commits, so it would be unreliable sugar over
`commit:`. To scope to a session's work, pass `commit:<range>` over that session's commits.
