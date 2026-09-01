---
name: triage-issues
description: >-
  Triage open issues in nrwl/nx. Applies the scope and type labels that make an issue count as
  triaged, asks for a reproduction when one is missing, runs the reproduction when one exists, and
  proposes a priority and an owner. Produces a plan you approve before anything is written to
  GitHub. Use on "triage this issue", "triage #12345", "triage the untriaged backlog", "does this
  issue have enough information", "is this issue actionable", "what's missing from this issue".
allowed-tools: Bash(.claude/tools/triage *), Bash(gh issue *), Bash(gh label *), Bash(gh search *), Bash(gh api *), Bash(git log *), Bash(git tag *), Bash(cat *), Bash(head *), Bash(sed *), Bash(grep *), Read, Grep, Glob, Write(/tmp/**), Skill
argument-hint: '[<issue number or url> ...]  (no args: sweep the untriaged queue)'
---

# Triage an nx issue

An issue is **triaged** when it carries at least one `scope:` label. That is not a convention, it is
the definition in `scripts/issues-scraper/scrape-issues.ts` — every open issue with no `scope:` label
increments `untriagedIssueCount`, which `.github/workflows/issue-notifier.yml` posts to Slack every
Sunday. Applying the right scope label is therefore the one step you cannot skip.

Everything else here exists to answer a second question: **can someone actually work this issue?**
That means a reproduction that runs, a version we can compare against, and a clear statement of what
was expected.

## Guardrails

Read these before touching anything. Most of them are irreversible in one direction.

- **Nothing is written to GitHub until a human approves it.** Every mutation goes through
  `.claude/tools/triage` (Step 11), which stages it as a reviewable record. That tool is the only
  thing in this workflow that calls `gh issue edit` or `gh issue comment`.
- **Never close an issue directly.** Stage the close as a proposal with its reason and a comment
  explaining it; a human approves it. The tool refuses to stage a close that has no comment.
- **Never apply `stale` or `outdated`.** Both are bot-owned — `stale` by
  `.github/workflows/schedule-stale.yml`, `outdated` by `.github/workflows/lock-threads.yml` on
  threads closed 30+ days. Setting either by hand corrupts the bots' bookkeeping.
- **A `blocked:` label is an eviction timer, not a note.** The stale bot watches
  `blocked: repro needed`, `blocked: more info needed` and `blocked: retry with latest`: 7 days of
  silence marks the issue `stale`, 21 more close it. Putting one on a well-formed issue deletes it in
  four weeks and nobody will notice. Apply one only when you can name the specific missing thing.
- **Taking a `blocked:` label off is part of the job.** `remove-stale-when-updated` strips `stale`
  when the reporter replies, but leaves the blocker in place, so the issue keeps re-entering the
  stale cycle. If the reporter has answered, removing the blocker is the highest-value edit you make.
- **Comments are public and permanent.** Show the exact text before posting. The stale bot already
  nags on a schedule; your comment should say something it can't.
- **Priority and assignee are proposals.** Present them with the evidence behind them. Only apply
  them if the user says so and the account running `gh` has write access.

Without write access — an outside contributor, or a token scoped to reads — every analysis step still
works. Say so in the report and hand over the `gh` commands instead of running them.

## 1. Pick the targets

```bash
# One or more explicit issues
gh issue view <N> --repo nrwl/nx --json number,title,body,labels,assignees,author,createdAt,updatedAt,comments,reactionGroups

# Or: the untriaged queue, defined exactly the way the scraper defines it
SCOPES=$(gh label list --repo nrwl/nx --limit 300 --json name \
  --jq '[.[] | select(.name | startswith("scope:")) | "-label:\"\(.name)\""] | join(" ")')
gh issue list --repo nrwl/nx --state open --limit 15 \
  --search "sort:created-desc $SCOPES" --json number,title,createdAt,labels
```

`startswith("scope:")` — no space — is deliberate: it matches the scraper, and it catches the
malformed `scope:gradle` label alongside the well-formed ones.

That query mirrors the scraper, so it finds everything that counts as untriaged. The scraper's bar is
the floor, though — an issue is only genuinely _worked_ when it has a **scope label, a priority, and
an owner**. Sweeping for issues missing any of the three finds real gaps the Slack number doesn't:

```bash
gh issue list --repo nrwl/nx --state open --limit 50 \
  --json number,title,labels,assignees --jq '[.[] | select(
    (.assignees | length == 0) or
    ([.labels[].name | select(startswith("scope:"))] | length == 0) or
    ([.labels[].name | select(startswith("priority:"))] | length == 0))] | .[:20]'
```

Default to 10 issues per sweep. Triage costs a reproduction run per issue, so a bigger batch is a
question for the user, not a default.

## 2. Read the whole issue before judging it

Pull body, comments, labels and `authorAssociation` in the one call above. Then, before you assess
anything:

- **Strip HTML comments.** The docs template (`.github/ISSUE_TEMPLATE/2-documentation.md`) ships its
  instructions as `<!-- … -->`, which otherwise reads as filled-in content.
- **A `Steps to Reproduce` section containing only `1.` is empty.** The bug form seeds that literal
  value (`1-bug.yml`, `id: reproduction`), so the section is present and required on every issue
  whether or not anyone typed into it. Presence of the heading proves nothing.
- **`type: bug` proves nothing either.** The form applies it on submit. Its _absence_ is the more
  useful signal: an issue with no labels at all was filed outside the template — through the API, or
  by an agent — so none of the form's required fields are guaranteed to be there. Check each one.
- **Strip the `nx report` block before you go looking for package names.** The report lists every
  installed plugin, so it implicates everything and identifies nothing. Scope comes from the title,
  the prose and the failing command.

## 3. Has this already been handled?

The most valuable thing triage does is take issues _off_ the pile. Do this before any expensive work
— there is no point reproducing a bug someone already has a PR open for.

### Is a PR already in flight?

```bash
gh issue view <N> --repo nrwl/nx --json closedByPullRequestsReferences \
  --jq '[.closedByPullRequestsReferences[]?.number] | join(", ")'
```

This is a first-class field and it populates for **open** issues too, not just closed ones. Prefer it
over scraping `/timeline` for `cross-referenced` events, which comes back empty on issues that
demonstrably have a linked PR.

If it names a PR, check what state that PR is in:

```bash
gh pr view <PR> --repo nrwl/nx --json state,mergedAt,title
```

- **Merged** → the issue is probably fixed. Propose a close as `completed`, naming the PR.
- **Open** → someone is on it. Do not assign it to anyone else and do not spend a reproduction run on
  it. Record it as `linked_pr` and move on.

If no PR is linked but you suspect one exists, search before concluding there isn't:
`gh pr list --repo nrwl/nx --state open --search "<key terms>"`.

### Is it a duplicate, or already answered?

```bash
gh search issues --repo nrwl/nx --limit 15 "<3-5 distinctive terms from the title>"   # includes closed
```

- **Duplicate** → propose a close with reason `duplicate` (a first-class close reason — don't file
  duplicates under `not planned`), linking the original. Keep whichever issue has the better
  reproduction, not the older number.
- **Ball is already in the reporter's court** → read the last comment whose author isn't a bot. Each
  comment carries its own `authorAssociation`; the issue itself does not, so pull the reporter's
  standing separately if you need it (`gh api repos/nrwl/nx/issues/<N> --jq .author_association`). If
  a maintainer (`OWNER`, `MEMBER`, `COLLABORATOR`) asked a question and nobody answered, the issue is
  waiting on them — leave it alone. If the reporter _did_ answer, remove the `blocked:` label.

### Other grounds for proposing a close

- **Reporter or a commenter confirmed it's resolved** → `completed`.
- **Root cause is upstream** and the upstream fix has shipped → `not planned`, linking upstream.
- **The reported version is two or more majors behind** → this is _not_ grounds for a close on its
  own. Re-run the reproduction against canary (Step 7) and let the result decide.

### What not to close

**Do not hand-close stale or no-reproduction issues.** `.github/workflows/schedule-stale.yml` already
runs that countdown, and it resets when the reporter replies. Closing by hand overrides a bot that
may have deliberately kept the issue alive, and it does the bot's job twice. Apply the `blocked:`
label and let the timer run.

Every close is a _proposal_ — staged, then approved by a human (Step 10). Nothing here closes an
issue directly.

## 4. Completeness gate

Judge against what `.github/ISSUE_TEMPLATE/1-bug.yml` actually collects:

| Field                        | Form requires it | What it's for                                                              |
| ---------------------------- | ---------------- | -------------------------------------------------------------------------- |
| Current / Expected Behavior  | yes              | Can be a single word and still pass validation — read them.                |
| **GitHub Repo**              | **no**           | The most valuable field is optional, so it's the one most often absent.    |
| Steps to Reproduce           | yes              | Often just the seeded `1.`.                                                |
| Nx Report                    | yes              | Version, OS, node, package manager. Without it you cannot check staleness. |
| Failure logs, PM version, OS | no               | Nice to have; never block on these alone.                                  |

Then pick at most one blocker:

- **`blocked: repro needed`** — the report is understandable but nothing here can be run: no repo
  link, and no steps that could be turned into commands.
- **`blocked: more info needed`** — you cannot tell what is broken, or there's no `nx report` so
  there's no version to test against.
- **`blocked: retry with latest`** — it reproduces on the reported version but the reported version
  is well behind, and you have reason to think it's fixed. Name that reason.
- **Neither** — the issue is workable. Say so; that is the outcome we want.

Never stack two blockers. The stale bot treats each as an independent countdown and the reporter gets
two nag comments for one problem.

## 5. Scope labels

At least one, always. Full mapping in `references/labels.md`; the rules that matter:

- **Label the package whose code has to change**, not every package named in the issue. A webpack
  build failing because `@nx/js` emits a bad `package.json` is `scope: js`.
- **`scope: core` is not a catch-all.** It means nx itself: the CLI, the daemon, the project graph,
  hashing and caching, `nx migrate`, task running, `targetDefaults`.
- **More than one scope is fine.** The scraper counts an issue under every scope it carries.
- **Some labels are dead or route elsewhere** — `scope: gatsby`, `scope:gradle` (use `scope: java`),
  `scope: console` (that code lives in `nrwl/nx-console`). See the reference before using them.

## 6. Type and the remaining labels

- `type: bug` — already applied by the form. Remove it if the issue is not a bug.
- `type: docs` — wrong, missing or misleading documentation.
- `type: enhancement` vs `type: feature` — enhancement improves something that exists; feature adds
  something new. Note that `.github/ISSUE_TEMPLATE/config.yml` sends feature requests to Discussions,
  so a feature request filed as an issue should be redirected rather than labeled.
- `type: question / discussion` — usage question. Point at Discussions or the Discord and propose a
  close.
- `os: windows` — the `nx report` shows win32 **and** the failure is plausibly platform-specific
  (paths, separators, permissions, command length). Not just because the reporter uses Windows.
- `community` — small, well-scoped, and the fix location is obvious from the issue. This is the
  "good first issue" signal, so only use it when a newcomer really could land it.
- `blocked: third-party` — the bug is in a dependency. Link the upstream issue, or say that filing
  one is the next step.

## 7. Reproduction: present, usable, and does it still happen

Three tiers. Do them in order and stop when one answers.

1. **Present?** A repo link, a sandbox link, or steps that name real commands.
2. **Usable?** A link to a repo that no longer exists, a private repo, a 40k-file monorepo, or "run
   my app" is not usable. Say specifically what would make it usable.
3. **Does it still reproduce?** Run it.

### Two modes, and the one that gets wrongly skipped

| Mode           | What the issue gives you                                            | What the sandbox does                                         |
| -------------- | ------------------------------------------------------------------- | ------------------------------------------------------------- |
| **A — clone**  | a repo or sandbox URL                                               | clone it, install, run the failing command                    |
| **B — replay** | self-contained steps from `create-nx-workspace` plus concrete edits | scaffold the workspace from those steps, then run the command |

**Never skip an issue just because there is no repo to clone.** Mode B is the normal shape for core,
hashing and CLI bugs, where the setup is ten lines and a repo would be overkill — a good Mode B report
is _more_ runnable than a stale repo, not less. Steps qualify when they start from a command anyone
can run and every later step is a concrete edit or command. "Configure module federation and build"
does not qualify.

**For Mode B, run the control too.** Most step lists contain a variant that behaves correctly
("without the `./` prefix it's a cache miss"). Running both arms proves the mechanism instead of
observing a symptom, and it catches a scaffold you built wrong — which otherwise reads as "does not
reproduce".

### Running it

Hand off to the `reproduce-issue` skill, which executes untrusted repro code inside a container so
install scripts never touch the host. Pass it what triage already worked out — the mode, the URL or
transcribed steps, the exact command, and the version from `nx report` — so it doesn't re-derive them.

```
# Mode A
Skill(reproduce-issue): repo:<git-url>  nx-version:<version from nx report>  command:"<failing command>"

# Mode B
Skill(reproduce-issue): create:"<create-nx-workspace args>"  setup:"<the edits the steps describe>"
                        command:"<failing command>"  nx-version:<reported>
```

Never run a repro command on the host.

### Which versions to run against

Always start on the **reported** version. Then:

- Reproduces there → re-run on **`nx@latest`**. If it's fixed, you have a close with evidence.
- The reported version is **two or more majors behind** → re-run against **`nx@canary`**
  (`npm view nx dist-tags` for the current one; `canary` tracks master). Age alone never justifies a
  close, but a canary run turns "probably fixed by now" into a fact either way:
  - still reproduces → say so in a comment, with what you ran, and update the issue to reflect that
    it's live on master. Do not propose a close.
  - clean on canary → propose a close as `completed`, quoting both runs.

### Feeding the result back

The repro outcome outranks every guess made in Steps 5-8. Revise labels and priority to match:

| Outcome                                 | Labels                          | Priority                                                        |
| --------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| Reproduces on latest or canary          | remove `blocked: repro needed`  | keep, or raise one level if it blocks build/serve/test/generate |
| Reproduces on reported, clean on latest | remove `blocked: repro needed`  | propose a close as `completed`                                  |
| Does not reproduce anywhere             | add `blocked: more info needed` | cap at low                                                      |

"Does not reproduce" is a finding, not a failure, and never grounds for a close on its own — it means
your environment differed, not that the reporter is wrong. Say exactly what you ran and what you got,
and ask what differs.

### Sweeping a batch

`reproduce-issue` leaves its container up for inspection. Across a sweep those accumulate: tear each
one down before moving to the next issue unless it holds something you still need.

```bash
docker rm -f nx-repro-<N>
```

## 8. Priority (proposal)

Use the label descriptions as written, and cite evidence for the choice:

- **`priority: high`** — "important issues which affect many people severely". A regression in a
  default code path, a broken upgrade, data loss, no workaround. Must plausibly affect many people,
  not one reporter.
- **`priority: medium`** — the default when nothing pushes it either way.
- **`priority: low`** — "does not affect many people, or not severely, or has an easy workaround".

**Calibrate against the real distribution.** Across a 400-issue sample the split was roughly **16%
high, 64% medium, 20% low**. If a sweep is coming out much hotter than that, the bar has slipped —
high is for the ones that would interrupt someone's week.

Evidence worth citing: is it a regression (worked in X, broke in Y) or longstanding; does a stated
workaround exist; is the broken path a default or an opt-in configuration; how many reactions and
duplicates; whether a reproduction confirmed it. Say which of these you found, and say when you
found none.

## 9. Owner (proposal)

Areas route through `.claude/tools/triage-owners.json`, and rows with several owners rotate so one
person doesn't absorb a whole sweep:

```bash
.claude/tools/triage owner "scope: core"      # prints the next login and advances the rotation
```

Empty output means the scope has no configured owner. Fall back to who has actually been changing the
implicated code — `CODEOWNERS` here is a single catch-all rule and routes nothing:

```bash
gh api "repos/nrwl/nx/commits?path=packages/<pkg>&per_page=100" --jq '.[].author.login' \
  | grep -v '\[bot\]' | sort | uniq -c | sort -rn | head
```

Two rules:

- **Don't assign an issue that already has a PR in flight** (Step 3). Someone is on it.
- Ownership moves. When a row in the table is wrong, fix the table rather than working around it.

## 10. Before proposing `community`: can the fix actually be contributed?

`community` means "a good first issue". That signal is a lie if the fix lives in code a contributor
cannot see or PR, and it wastes the time of the person who takes it.

**Check where the change would land.** If it's under `packages/`, `graph/`, `astro-docs/` or another
in-repo directory, it's contributable. It is not contributable when the fix lives in:

| Area                                                                      | Where the fix actually lives                                                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| the published `@nx/graph` package                                         | closed source — self-describes as "Internal utilities for Nx graph visualization, not intended for external use" |
| `@nx/s3-cache`, `@nx/gcs-cache`, `@nx/azure-cache`, `@nx/shared-fs-cache` | Powerpack cache plugins, closed source                                                                           |
| `@nx/powerpack-*`                                                         | Powerpack, closed source                                                                                         |
| Nx Console (the editor extensions, nxls)                                  | separate repo, `nrwl/nx-console`                                                                                 |
| Nx Cloud (dashboards, runners, self-healing service)                      | separate service                                                                                                 |

**The graph is the one that catches people.** The repo _does_ ship graph UI source — `graph/client`,
`graph/ui-project-details`, `graph/ui-render-config` and friends are all in-tree. Those in-tree
packages then `import from '@nx/graph'`, which is the closed one. So "it's a graph bug" decides
nothing: grep for the code you would change. Under `graph/` it's contributable; resolving into
`node_modules/@nx/graph` it isn't.

When the fix isn't contributable, don't propose `community` — say in the report that the team handles
it internally, and if the label is already on the issue, propose removing it.

When you _do_ propose `community`, the comment should carry the specifics: the root cause, the file
to change, roughly what the change is, and how to test it. If a reproduction validated a fix, put
that in — a community comment with a proven diff is worth ten with a hypothesis.

## 11. Stage it, let a human approve, then apply

Do not call `gh issue edit` or `gh issue comment` yourself. Stage each issue through
`.claude/tools/triage`, which holds the mutation in a reviewable record until a human approves it.

```bash
cat > /tmp/triage-36863.json <<'JSON'
{
  "issue": 36863,
  "title": "nx:run-commands captures task output on exit instead of close",
  "add_labels": ["scope: core", "type: bug", "priority: high"],
  "remove_labels": [],
  "assign": "FrozenPandaz",
  "repro": "nx-examples + two targets; reproduces on 21.2.0 and 23.1.1",
  "linked_pr": "",
  "close_reason": "",
  "comment": "Confirmed on 23.1.1 ...",
  "rationale": "Regression in a default code path, no workaround."
}
JSON
.claude/tools/triage stage < /tmp/triage-36863.json
```

Always stage from a **file on stdin**, never with `--json '<inline>'`. Comment prose carries
backticks and quotes, and argv is not a safe place to carry either.

`close_reason` is empty for most records. Set it to `completed`, `not planned` or `duplicate` to
propose a close; `linked_pr` records a PR already targeting the issue (Step 3).

The tool refuses to stage a record that sets `stale` or `outdated`, that starts two stale countdowns
at once, that adds and removes the same label, or that closes an issue without a comment — so those
guardrails hold even when this document is only skimmed.

Then tell the user what is waiting, and stop:

```bash
.claude/tools/triage list
```

> 3 issues staged. Run `pnpm triage-tui` to approve them.

`review` is a TUI: `a` approves, `x` rejects, `c` leaves a note back to you, `o` opens the issue on
GitHub, `e` opens the record in `$EDITOR` so they can fix a label or rewrite a comment directly. It needs a terminal, so **the user**
runs it, not you.

### Circling back

Once they have been through the queue, pick the work back up:

```bash
.claude/tools/triage feedback     # what they asked you to change, and why
.claude/tools/triage apply        # applies only the records they approved
```

Restage an issue after addressing feedback with the same `stage` command — it keeps their note on the
record until it is applied, so you can check your revision against what they actually asked for.

`apply --dry-run` prints the exact `gh` commands without running them. Use it whenever you are unsure
what a record resolves to.

Close by reporting what actually changed: issues staged, what the user approved or rejected, blockers
applied and removed, reproductions run and their outcomes, and anything you left alone and why.
