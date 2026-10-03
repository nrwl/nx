# Choosing an owner

Shared by `triage-issues` and `triage-prs`. Every staged record carries an assignee, and the
rules for picking one do not differ between an issue and a pull request.

**Every record you stage carries an assignee. There is no "leave it unassigned" outcome.** An issue
with a scope label but no owner is still nobody's job; it satisfies the scraper and gets forgotten,
which is the failure this step exists to prevent. If you cannot name an owner, that is a signal to
work harder at the routing, not to leave the field empty.

**The assignee is always an Nx team member.** Never assign a community member, including the author
of the linked PR. The assignee is the person accountable for getting the change over the line —
reviewing it, asking for what it still needs, and merging it — which is not something an outside
contributor can do for their own PR. Everyone in `triage-owners.md` is on the team, so following
the table is safe by construction; the place this goes wrong is the git-history fallback below, which
happily surfaces frequent outside contributors. Check the name before you use it.

This holds in the cases you will be tempted to skip:

- **A PR is already open.** The PR decides the owner — see the procedure directly below.
  Do not fall through to the rotation without checking it.
- **You applied a `blocked:` label.** The issue still needs an owner to read the answer when the
  reporter replies, otherwise it just runs out the stale clock unattended.
- **You marked it `community`.** Assign the maintainer who would shepherd and merge the contribution.
  `community` advertises the issue to contributors; it does not remove the need for someone inside to
  land it.

### When a PR already fixes it, the PR decides the owner

The Step 2 payload carries each linked PR's `author`, `authorAssociation` and `assignees`, so this
costs no extra call. Take them **in this order** and stop at the first that applies:

1. **The PR has an assignee** → assign that person. Someone has already taken the merge, and routing
   the issue anywhere else invents a second owner for work that is spoken for. Sanity-check the login
   against `triage-owners.md`; GitHub will let a non-collaborator be assigned in some cases, so an
   assignee who is not on the team is a signal to keep reading, not a verdict.
2. **No assignee, and the PR author is a maintainer** — `authorAssociation` of `OWNER`, `MEMBER` or
   `COLLABORATOR` → assign the author. They wrote the fix and can land it.
3. **The PR author is a community member** — `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR` or `NONE` →
   **do not assign them**, and do not leave it empty either. Fall through to the scope owner below.
   They cannot review or merge their own work, so the issue still needs someone inside to land it.
4. **The author is a bot** — a login ending in `[bot]`, or an app account like `polygraph-app` →
   never the assignee. Treat it as case 3.

`authorAssociation` is the whole test, and it is why this cannot be done by eye: on the live backlog,
the PRs linked from issues are overwhelmingly community-authored. Measured on real linked PRs:

```
36864  MEMBER       FrozenPandaz   assignees=             -> assign FrozenPandaz      (rule 2)
36763  CONTRIBUTOR  Fnine59        assignees=AgentEnder   -> assign AgentEnder        (rule 1)
36867  CONTRIBUTOR  wangxpych      assignees=             -> scope owner, NOT wangxpych (rule 3)
36658  CONTRIBUTOR  polygraph-app  assignees=leosvelperez -> assign leosvelperez      (rule 1, bot author)
```

Say which rule you used in the rationale. "Assigned the PR author" and "assigned the person already
on the PR" are different claims, and the second one needs to be checkable.

Areas route through `.claude/tools/triage-owners.md`:

```bash
.claude/tools/triage owner "scope: release"   # suggests a login and advances the rotation
```

**Read its stderr — that is where the routing intelligence lives.** The login goes to stdout so
`$(…)` captures cleanly; the area's freeform `guidance`, the weighted candidate field, and any
per-person note all go to stderr. A row is not a flat list of equals:

```
guidance for "scope: release": James has the deepest release knowledge, but Jason and
  Craigory can both work this area and James is mostly outside the nx repo right now. …
-> FrozenPandaz (weight 3)
   AgentEnder (weight 3)
   JamesHenry (weight 1) — Deepest knowledge of nx release, but his bandwidth is currently
     spent outside the nx repo. Suggest him only when an issue genuinely needs that depth …
```

**`weight` is a likelihood, `guidance` is an instruction, and the pick is a suggestion.** The
selector spreads a sweep across the field in the configured ratio — it does not know anything about
the issue in front of you. When the guidance or the issue points elsewhere, override it and say why
in the rationale. In the example above, a routine release bug goes to Jason or Craigory even though
James knows the area best; an issue that turns on release internals nobody else has context on is
exactly the case the guidance carves out for him.

`people.<login>` sets defaults that follow a person across every scope, which is where a standing
fact like reduced bandwidth or leave belongs — put it there once rather than repeating it per row. A
per-scope `weight` overrides it; `weight: 0` keeps someone listed but never auto-suggested.

**Non-scope rows bias, they do not override.** `os: windows` is a row too, because Windows issues
route on who has the hardware rather than who knows the area. But the area still owns the bug, so
that row spends part of its rotation on a `defer` candidate that hands back to the scope. Pass both:

```bash
.claude/tools/triage owner "os: windows" --scope "scope: release"
```

Roughly three in four land on the person with the Windows desktop and the rest fall through to the
scope owner. Without `--scope` a deferred turn prints nothing on stdout and tells you to re-run —
deliberately, so an unresolved bias can't quietly collapse into "always the same person".

Empty output means the scope has no configured owner (`scope: misc` and the closed-source rows are
deliberately empty). Fall back to who has actually been changing the implicated code — `CODEOWNERS`
here is a single catch-all rule and routes nothing:

```bash
gh api repos/nrwl/nx/commits --method GET -f path=packages/<pkg> -f per_page=100 \
  --jq '.[].author.login' | grep -v bot | sort | uniq -c | sort -rn | head
```

Two rules:

- **The suggestion is a default, not a verdict.** When something in the issue names a better owner —
  the person already reviewing the linked PR, the author of the change that caused the regression,
  the author of the fix you think already covers it — take that over the suggestion and say why in
  the rationale.
- Ownership moves, and so does bandwidth. When a row is wrong, fix the table rather than working
  around it: adding a name you derived from commit history, re-weighting someone who has picked up or
  handed off an area, or writing the reason into `guidance` so the next sweep inherits it. A routing
  decision you had to reason out and did not record is one the next sweep pays for again.
