Before changing files, check the deterministic migration's `agentContext`.
If it reports no remaining work, or every affected registration already has an explicit
`tfmVariants` choice, change nothing and stop.

The generator has already preserved statically recognized custom builds by setting
`tfmVariants: false` on their matching `@nx/dotnet` registrations.
Verify those changes; don't repeat or broaden them.

Resolve only the reported cases:

- For malformed `nx.json`, `project.json`, or `package.json`, recover the intended configuration
  only when its meaning is clear. Otherwise leave it unchanged and report the exact file and
  required human decision.
- For inherited configuration, follow `nx.json` inheritance to the file that declares the
  affected registration or defaults. Preserve plugin order, include/exclude scope, and all
  unrelated registrations. Don't modify installed package files or blindly replace an
  inherited plugin list. If a local override can't preserve inheritance semantics confidently,
  report the required manual opt-out instead.
- For project-filtered target defaults without a statically declared Nx name, obtain the
  evaluated project identity for the reported .NET project. Use the available Nx project graph,
  not an assumption that the project file's basename is its configured name. Check whether the
  existing defaults apply to its build or legacy Release target. Set `tfmVariants: false` only
  on the matching registration when its custom command, configuration, output, argument,
  parallelism, or caching contract needs the former inference behavior.

Preserve existing explicit `tfmVariants: true` and `tfmVariants: false` values.
Don't turn standard or unrelated registrations off merely because the new default changes the
shape of their inferred tasks.
`tfmVariants: false` also suppresses RID variants, so don't add a duplicate RID migration or
rewrite runtime identifiers.

When a graph can be evaluated safely, verify the affected project's targets after the edit.
If SDK availability or unresolved configuration prevents verification, report that limitation
instead of claiming the upgrade is complete.
