---
name: triage-issues
description: >-
  Triage open issues in nrwl/nx. Applies the scope and type labels that make an issue count as
  triaged, asks for a reproduction when one is missing, runs the reproduction when one exists, and
  proposes a priority and an owner. Produces a plan you approve before anything is written to
  GitHub. Use on "triage this issue", "triage #12345", "triage the untriaged backlog", "does this
  issue have enough information", "is this issue actionable", "what's missing from this issue".
allowed-tools: Agent, Bash(.claude/tools/triage *), Bash(TRIAGE_DIR=* .claude/tools/triage *), Bash(.claude/tools/sandbox *), Bash(gh issue view *), Bash(gh issue list *), Bash(gh search issues *), Bash(gh pr view *), Bash(gh pr list *), Bash(gh label list *), Bash(gh api graphql *), Bash(gh api repos/nrwl/nx/*), Bash(npm view *), Bash(head *), Read, Grep, Glob, Write(/tmp/**), Skill
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
  thing in this workflow that calls `gh issue edit` or `gh issue comment`. This is enforced, not
  asked for: `allowed-tools` above grants `gh issue view` and `gh issue list` and nothing else, so
  `gh issue edit`, `comment` and `close` are unavailable here even if you reach for them. It grants
  no `rm` either, so the state directory cannot be cleared from inside this skill.
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
- **Every record carries a priority, an assignee and a comment** (Steps 8, 9 and 11). All three are
  proposals — the approval step is what makes them real — but none may be left blank, including on an
  issue that already has a PR open or that you just blocked. Present the evidence behind each.
  Applying needs the account running `gh` to have write access.
- **A record that changes an issue without telling the reporter why is not finished.** Labels,
  priority and an assignee appearing with no comment is indistinguishable from a bot relabelling
  someone's thread. The comment is the part they can read, and the part they can argue with.

Without write access — an outside contributor, or a token scoped to reads — every analysis step still
works. Say so in the report and hand over the `gh` commands instead of running them.

## 1. Pick the targets

For one or more explicit issues:

```bash
gh issue view <N> --repo nrwl/nx --json number,title,body,labels,assignees,author,createdAt,updatedAt,comments,reactionGroups
```

For a sweep, this is the queue. An issue is untriaged when it is missing **any** of the three things
that make it workable — a `scope:` label, a priority, or an owner:

```bash
gh issue list --repo nrwl/nx --state open --limit 300 \
  --json number,title,labels,assignees --jq '[.[] | select(
    (.assignees | length == 0) or
    ([.labels[].name | select(startswith("scope:"))] | length == 0) or
    ([.labels[].name | select(startswith("priority:"))] | length == 0))][].number' \
  > /tmp/untriaged.txt
```

**Unassigned counts as untriaged**, which is why `assignees` is in that predicate. An issue nobody
owns is not going to move, whatever labels it carries.

`startswith("scope:")` — no space — is deliberate: it matches how `scripts/issues-scraper` counts,
and it catches the malformed `scope:gradle` label alongside the well-formed ones.

That query is a strict superset of the scraper's narrower definition (open issues with no `scope:`
label at all), which is the number `issue-notifier.yml` posts to Slack weekly. Measured on the live
backlog: 46 by this query, 44 by the scraper's, **0 issues in the scraper's set that this one misses**.
So working this queue always moves the Slack metric; it just also catches issues that have a scope but
no owner or priority.

`--limit` is not a page size — `gh` paginates up to it — so set it above the backlog and let the query
return everything. Do **not** cap the enumeration: a truncated list is indistinguishable from a short
one, and the sweep then reports done having seen a fraction of the queue.

**Stage a record for every issue the query returns.** Staging is cheap — reading an issue and choosing
labels, a priority and an owner costs no container and no network beyond the fetch. The expensive step
is reproduction, and that is a _separate_ decision (Step 7): a record stages fine with `repro: not
run`, and reproductions follow for the subset where the outcome would change the verdict.

Work through the queue in batches of about ten if that keeps the reading manageable — but **a batch is
a pause, not the end**. Keep going until the queue is empty, and if you do stop early, say how many
remain and why. "I triaged 10" when 46 were waiting is a report that reads as completion.

## 2. Fetch the queue in one call, then read each issue

Do **not** loop `gh issue view` over the queue. Everything the later steps need — body, labels,
assignees, the issue's own `authorAssociation`, each comment's association, linked PRs, and reaction
counts — comes back from one GraphQL query, aliasing each issue by number:

```bash
# build the query from the queue produced in Step 1
{ echo 'query { repository(owner: "nrwl", name: "nx") {'
  while read n; do echo "  i$n: issue(number: $n) { ...F }"; done < /tmp/untriaged.txt
  echo '} }'
  cat <<'GQL'
fragment F on Issue {
  number title createdAt authorAssociation
  author { login }
  labels(first: 20) { nodes { name } }
  assignees(first: 5) { nodes { login } }
  reactionGroups { content users { totalCount } }
  closedByPullRequestsReferences(first: 10, includeClosedPrs: true) {
    nodes {
      number state title
      author { login }
      authorAssociation
      assignees(first: 5) { nodes { login } }
    }
  }
  comments(first: 30) { nodes { author { login } authorAssociation createdAt body } }
  body
}
GQL
} > /tmp/triage-q.graphql

gh api graphql -F query=@/tmp/triage-q.graphql > /tmp/triage-issues.json
```

The whole backlog fits in one call — 46 issues measured, ~230KB. **Write it to a file and read issues
out of it one at a time**; pasting the whole payload into context costs ~57k tokens and buys nothing,
since each issue's slice is self-contained.

This is what makes a full sweep practical. The REST path needed three calls per issue — `issue view`,
a separate `gh api` for the issue-level `authorAssociation`, and another for
`closedByPullRequestsReferences` — so 46 issues meant ~140 round trips. Here it is one.

The PR fields are there because the owner decision (Step 9) turns on them: who wrote the fix, whether
they are a maintainer, and whether someone has already taken it. Fetching them here keeps that a
property of the same single call.

Before judging any issue, from its slice:

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

Steps 3-10 are the per-issue loop. Run them for one issue, **stage that issue's record (Step 11), and
only then read the next one.** Do not carry a pile of undecided issues in your head to write out at
the end — the reviewer is watching records land and the TUI refreshes as they do.

## 3. Has this already been handled?

The most valuable thing triage does is take issues _off_ the pile. Do this before any expensive work
— there is no point reproducing a bug someone already has a PR open for.

### Is a PR already in flight?

`closedByPullRequestsReferences` is already in each issue's slice from Step 2 — no extra call. It is a
first-class field and populates for **open** issues too, not just closed ones. Prefer it over scraping
`/timeline` for `cross-referenced` events, which comes back empty on issues that demonstrably have a
linked PR.

If it names a PR, check what state that PR is in:

```bash
gh pr view <PR> --repo nrwl/nx --json state,mergedAt,title
```

- **Merged** → the issue is probably fixed. Propose a close as `completed`, naming the PR.
- **Open** → someone is on it. Do not spend a reproduction run on it. Record it as `linked_pr` and
  move on — but **still give it an assignee** (Step 9). An open PR does not mean the issue is
  someone's; the PR author is often an outside contributor, and the issue still needs the maintainer
  who will _review_ that PR. That is who the assignee names.

If no PR is linked but you suspect one exists, search before concluding there isn't:
`gh pr list --repo nrwl/nx --state open --search "<key terms>"`.

### Has a fix already landed, unlinked?

`closedByPullRequestsReferences` only finds PRs that used a closing keyword. A fix that landed while
someone was working on something else — or that fixed this bug as a side effect of a different
report — leaves no link at all, and the issue sits open looking untriaged. Nothing in the issue can
tell you this happened. Only the history can, so go and read it.

**Scan the commits from the issue's `createdAt` forward**, scoped to the package the bug implicates:

```bash
git fetch origin master
git log origin/master --oneline --since="<issue createdAt>" -- packages/<pkg>
git log origin/master --oneline --since="<issue createdAt>" -i \
  --grep="<distinctive term>" --grep="<another one>"     # multiple --grep are OR'd
```

Pull the distinctive terms from the failing symbol, file or error string rather than the title — a
commit message says `fix(nextjs): make built next.config load without @nx/next installed`,
never the reporter's phrasing. That real example is from #36426, where the reporter's title said
"`.nx-helpers/compose-plugins.js` requires `./deprecation`" and the fix's message shares not one
of those words.

**Fetch first.** A checkout a week stale hides exactly the recent fix you are looking for, and the
search then comes back empty in a way that is indistinguishable from "nobody has fixed it". That is
the failure this whole subsection exists to prevent, and it is silent.

Three outcomes, and they are not interchangeable:

- **Nothing related** → carry on with the normal flow.
- **A fix landed and has shipped** → propose a close as `completed`, naming the commit and the
  release. Confirm it with a canary run (Step 7) rather than trusting the diff — a diff that looks
  like it fixes the bug is the weakest evidence in this document.
- **A fix landed but has not shipped** → **not** a close. `git tag --contains <sha>` names the
  releases carrying it, and empty output means none do. The reporter needs to know which version to
  wait for, and that is a comment.

### Is it a duplicate, or already answered?

```bash
gh search issues --repo nrwl/nx --limit 15 "<3-5 distinctive terms from the title>"   # includes closed
```

- **Duplicate** → propose a close with reason `duplicate` (a first-class close reason — don't file
  duplicates under `not planned`), linking the original. Keep whichever issue has the better
  reproduction, not the older number.
- **Ball is already in the reporter's court** → read the last comment whose author isn't a bot. Each
  comment carries its own `authorAssociation` in the Step 2 payload, and so does the issue itself. If
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
  (paths, separators, permissions, command length). Not just because the reporter uses Windows. This is
  a claim you can check rather than assume: a Windows VM is reachable from here (see Step 7), so
  "platform-specific" is testable in both directions — including confirming a bug does _not_ need Windows.
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

### The default is to run it

**Attempt a reproduction for every issue that has usable steps and no open PR.** Not the interesting
ones, not the ones where you are unsure — all of them. `repro: not run` is for two cases only:

- **An open PR already covers it.** Someone is on it and their PR carries the evidence; a run buys
  nothing. This is the common exemption in a sweep and it is why Step 3 comes first.
- **The report has nothing runnable**, which means you are applying `blocked: repro needed` anyway.

A `repro` field that starts `not run` **must name which of those two it is, in its first sentence** —
`not run: PR #NNNNN is open` or `not run: nothing runnable, blocked: repro needed applied`. Anything
else in that slot is a third case, and there is no third case. Writing the reason first is the point:
a prose paragraph explaining why this particular issue was hard is what a skipped run looks like from
the inside, and naming the category refuses to accommodate it.

Before you stage a sweep, check yourself against the queue: every record whose `repro` starts `not
run` should have a linked PR or a `blocked: repro needed` label. Any record with neither is a run you
talked yourself out of.

Everything else gets a run. "The report is detailed enough that a run would only confirm it" is not
an exemption — a detailed report is the _easiest_ thing to run, and detailed reports have been wrong.
Neither is "the mechanism is obvious from the source": reading tells you what the code should do, and
a run tells you what it does.

#### The excuses that have actually been used

Every line below was written into a real `repro: not run` field on a record in this repo, sounded
reasonable at the time, and was wrong. If your reasoning is about to rhyme with one of these, run it.

| What the record said                                                                                                   | Why it does not hold                                                                                                                                   | Do this                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| "The root cause is confirmed against current master"                                                                   | Reading verifies the _mechanism_ while assuming the _symptom_. A grep can only agree with you.                                                         | Run the steps, then cite the source as the explanation of what you saw.                   |
| "The distinguishing ingredient is <tool>'s managed pty / sandbox / wrapper, and faking it reproduces the passing case" | Correct, and the conclusion is backwards: do not fake it. The tool is installable.                                                                     | `npm i <tool>` in the container and run the real thing.                                   |
| "Corroborated from the other direction by the reproduction on #NNNNN"                                                  | A sibling issue's run is evidence about the sibling. Two issues that look like one mechanism are exactly the pair where one turns out to be different. | Run this one too. It is a directory and an install.                                       |
| "It is a long-lived foreground process, so capturing it means killing it on a timer and reading partial output"        | That is what a timeout is for, and partial output is the evidence. A watcher that hangs _is_ the finding.                                              | `timeout 60 <cmd>; echo EXIT=$?` and report what came out.                                |
| "The report is a structural comparison rather than a failure"                                                          | Then the run is trivially cheap and produces the actual tree instead of a described one. Reporters mis-transcribe trees.                               | Generate both, `diff -r` them, paste the diff.                                            |
| "It needs a browser / a live dev server pair"                                                                          | The only one on this list that can be legitimate — but it applies to the _observation_, not the whole run.                                             | Run the scaffold anyway, report how far it got, and say precisely which step needed eyes. |

The shape they share: each substitutes **reading, or reasoning about a neighbour, for running**, and
each produces a confident-sounding record. State the excuse out loud before accepting it — written
down, most of them stop sounding like an exemption and start sounding like the thing this section
exists to stop.

**Check the host OS before concluding "does not reproduce".** The sandbox is Linux. If the report is
darwin or win32 and the diagnosis names a platform API (`kevent`, `epoll`, `cmd.exe`, path limits), a
clean Linux run does not clear the bug — it narrows it. Say "did not reproduce on Linux; the reported
mechanism is macOS-specific" rather than "did not reproduce". Those are different findings and only
one of them is honest.

**Watch what your harness flags do to the bug.** Setting `CI=1` to stop a prompt eating a piped
script is standard practice here, and on an issue where `CI=true` is listed under "things that make
it work" it silently reproduces the passing case. Read the report's own list of what avoids the
problem, and check it against the flags you are about to set.

**Your own environment is a flag you did not set.** `CI` is the one you choose; these are set for you,
and each one silently reroutes the code under test:

| Set by                                       | What it changes                                                                                                                                           |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDECODE=1`, and the other `CLAUDE*` vars | `isAiAgent()` returns true, and `shouldUseTui()` returns false on it. Every TUI test an agent runs is on the non-TUI path unless the vars are stripped.   |
| The pty you run under                        | `is-tui-enabled.ts` gates on `process.stdout.columns > 0 && rows > 0`. A pty with no winsize (lefthook's inner pty reports 0x0) refuses the TUI outright. |
| `SANDBOX_RUNTIME=1`                          | `isSandbox()` is true inside the review sandbox, which some paths branch on.                                                                              |

The failure is always the same shape: the arm you believe is exercising the feature is quietly
exercising its absence, and it comes back clean. **Assert the state you are testing rather than
inferring it** — call the predicate (`shouldUseTui()`, `isAiAgent()`) from inside the harness and
print it, or find a byte-level tell such as the alternate-screen sequence `CSI ?1049h`. `#36579` was
measured twice on the non-TUI path, once for the explicit `--outputStyle=stream` and once for
`isAiAgent()`, before anyone checked.

**Driving the TUI in a loop has three traps, and each one costs an iteration.** They surfaced
reproducing `#36520`, where the arms had to run unattended 160 times per version:

- **`tui.autoExit: 0` means never auto-exit**, not "exit immediately". On 22.6+ the zero is a
  duration, so a loop set that way hangs forever waiting for a keypress. Use `true`.
- **22.7.x deliberately keeps the TUI open after a task fails**, and `--tuiAutoExit=true` does not
  override it. An unattended run therefore hangs on exactly the case you are trying to measure. Feed
  it a quit: `{ sleep 8; printf 'q'; } | script -qec "..." /dev/null`.
- **`--tui` and `--outputStyle` are mutually exclusive.** Passing both makes nx print its help and
  exit 1, which reads as the reproduction failing rather than as a bad invocation. The two axes
  cannot be crossed; vary them separately.

Give the pty a real size while you are at it (`stty rows 50 cols 200`), or the capability check
refuses the TUI and you measure the non-TUI path again.

**Reproductions are cheaper than they look, because they share one container.** `sandbox start` hands
out a workspace inside the _same_ long-lived host, so a second reproduction is a directory and an
install, not a new container — which is exactly why "a run is too expensive for this one" does not
hold up across a sweep. Keep one sandbox for a run of issues and `stop` the id when the batch is done,
rather than starting and tearing one down per issue.

A verdict of `blocked: repro needed`, or a proposed close, that was never executed is a guess wearing
the clothes of a finding.

**A run that comes back clean is a result, not a failure**, and it is often the most valuable outcome:
it converts "the reporter says X" into "X does not happen with these steps on these versions", which
either closes the issue or names the missing ingredient. Say exactly what you ran and what you got.

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

**"The scaffold would be expensive" is not a reason to skip.** We ship the generators. An issue whose
setup is "an Angular app with Playwright e2e" is a Mode B repro that `create-nx-workspace` plus
`nx g @nx/angular:app` plus `nx g @nx/playwright:configuration` produces in one sandbox run — reaching
for a source-reading verdict instead is choosing the weaker evidence when the stronger one was a
generator invocation away. Prose like "vague steps" or "needs a whole workspace" is the tell that you
are rationalizing; if our own generators can stand it up, stand it up.

Reading the source is a legitimate _supplement_ — it explains the mechanism a run only demonstrates —
but it is not a substitute. A run can contradict you; reading cannot.

When a Mode B scaffold reproduces, consider handing the reporter the artifact rather than a
description of it. A config file, or a small spec, that they can drop into their own workspace turns
"we reproduced it" into something they can verify and reuse.

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

### The sandbox is Linux — check whether the OS is the variable

The sandbox container is Linux, so it reproduces most issues faithfully and a handful not at all. Before
you write "not reproducible here", ask whether the OS _is_ the mechanism:

| Mechanism                                                                | Reproduces in the Linux sandbox? |
| ------------------------------------------------------------------------ | -------------------------------- |
| `cmd.exe` splitting an unquoted path, `%VAR%` expansion, `\` separators  | **no** — needs Windows           |
| Path length limits, file locking, reserved filenames, case-insensitivity | **no** — needs Windows           |
| macOS-only APIs, `kevent`, Keychain, code signing                        | **no** — needs the host          |
| Everything else — task graph, hashing, caching, generators, executors    | yes                              |

**A Windows VM is available on this machine, so `os: windows` is not automatically unrunnable.** Parallels
hosts a `Windows 11` VM that has node, npm and git, and `prlctl exec` drives it non-interactively:

```bash
prlctl list -a                       # is it running, suspended, or stopped
prlctl resume "Windows 11"           # note the state you found it in, and restore it after
prlctl exec "Windows 11" cmd /c "node --version & npm --version & git --version"
```

Two things that waste a cycle if you don't know them:

- **`prlctl exec` runs as a different account than the desktop session**, so mapped drives like `Z:` do
  not exist for it. Reach the Mac filesystem by UNC — `\\Mac\Home\...` — not by drive letter.
- **Argv quoting is fragile through `prlctl exec`.** Write the script to a file under the Mac home and
  invoke it by path, the same reason `sandbox exec` takes `bash -s` on stdin rather than an inline command.

**Prefer validating the mechanism over rebuilding the whole workspace.** A Windows repro does not have to
be a full `create-nx-workspace` run: if the claim is "an unquoted path with a space splits at the space",
a ten-line Node script that spawns a `.bat` from `C:\...\My Test Dir\` proves it, and a second arm that
quotes the binary proves the fix. That runs in seconds instead of provisioning a workspace, and it is
stronger evidence than reading the source — which is the trade this whole step exists to make.

Restore the VM to the state you found it in when you are done.

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

`reproduce-issue` leaves its sandbox workspace up for inspection. Across a sweep those accumulate:
stop each one before moving to the next issue unless it holds something you still need.

```bash
.claude/tools/sandbox stop <id>
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

## 9. Owner — every issue gets one

**Every record you stage carries an assignee. There is no "leave it unassigned" outcome.** An issue
with a scope label but no owner is still nobody's job; it satisfies the scraper and gets forgotten,
which is the failure this step exists to prevent. If you cannot name an owner, that is a signal to
work harder at the routing, not to leave the field empty.

**The assignee is always an Nx team member.** Never assign a community member, including the author
of the linked PR. The assignee is the person accountable for getting the change over the line —
reviewing it, asking for what it still needs, and merging it — which is not something an outside
contributor can do for their own PR. Everyone in `triage-owners.json` is on the team, so following
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
   against `triage-owners.json`; GitHub will let a non-collaborator be assigned in some cases, so an
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

Areas route through `.claude/tools/triage-owners.json`:

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

## 11. Approve and apply

### Attribute the analysis — don't write in the maintainer's voice

A triage comment is posted from a maintainer's account, so anything you write reads as _their_
technical judgement, permanently and in public. Findings you derived — a reproduction you ran, a
mechanism you read out of the source — must be visibly marked as triage notes rather than blended
into the maintainer's own words.

Put the derived part in a collapsed **Triage notes** `<details>` block, and leave any actual request
to the reporter outside it in plain prose:

```markdown
<details>
<summary>

#### Triage notes — automated triage, reviewed before posting.

</summary>

Reproduced on 23.2.0-beta.11 from the steps above:
```

--output-style=stream -> 5000 lines
--output-style=static -> 0 of 5000

```

Both runs exit 0, so the loss is silent.

</details>

Could you confirm whether you see this outside `run-commands` as well?
```

**The blank lines are load-bearing.** GitHub only parses Markdown inside `<details>` when the HTML
tags are separated from the content by blank lines. All four matter:

- after `<summary>`, and before `</summary>` — without them the summary renders as literal text,
  backticks, asterisks and all
- after `</summary>` — without it the first paragraph of the body swallows the tag
- before `</details>`

Get one wrong and the comment renders as raw HTML on a public issue, which is not something you can
tidy up afterwards without an edit everyone can see. If the body itself contains a fenced code block,
that fence still needs its own blank line above and below, exactly as it would outside the block.

Why the split, and why collapsed: the notes carry the evidence and can be wrong without putting words
in the maintainer's mouth, while the plain-prose ask is the human actually asking. Collapsing matters
more than it looks — a reproduction transcript, a version bisect and a source excerpt can run longer
than the issue being triaged, and an unfolded wall of that buries the one sentence the reporter is
supposed to act on. The summary line is what everyone reads; the evidence is there for whoever wants
it.

A comment that is _only_ a request to the reporter (a `blocked:` follow-up, a duplicate pointer) needs
no block at all — there is no derived analysis in it to attribute, and wrapping a single question in a
collapsed section just hides it.

**And never the inverse either: a comment that is _only_ a collapsed block.** Someone opening the
issue then sees a single summary line and nothing else, which reads as a bot dropping an artifact on
their thread. That is the exact impression the attribution split exists to avoid, so a bare
`<details>` defeats the point of using one. **Always write something in the open.** There is always
something, even when the derived analysis is the whole substance:

- **You found something** → the one sentence the reporter should act on: what it means for them,
  what happens next, or what you still need from them.
- **A PR is in flight** → name it and say what it changes.
- **A fix has landed** → the version to upgrade to.
- **A blocker went on** → the specific missing thing, as a question.
- **Genuinely none of the above** → thank them for filing it and say someone will take a closer look
  shortly. That is a weak comment. It is still better than a bare collapsed block, and it takes one
  line.

Put it **before** the block, not after. The reporter should not have to expand anything to find out
where their issue stands.

Keep that part short and in the maintainer's ordinary voice, because it is the part attributed to
them. The evidence inside the block can be as long as it needs to be; the prose outside it is one or
two sentences a person would actually say.

### Every record carries a comment — there are no exemptions

**If you are changing anything on the issue, say why on the issue.** A reporter watching their bug get
a `priority: low` and an assignee, with no word about what was found, has no way to tell considered
triage from a bot relabelling their thread — and no way to push back on a call they think is wrong.

**The `repro` field is the raw material.** It already holds what you ran, on which versions, and what
came back; that is precisely what the reporter cannot see and most wants to know. Turn it into the
Triage notes block rather than writing a second account from scratch — and where a run contradicted
part of the report, or ruled out a theory from the thread, say so, because that is the part that saves
them a debugging session.

This holds even when nothing dramatic happened. "Reproduced on the reported version and on latest" is
worth a sentence. So is "did not reproduce with these steps on these versions" — with the exact
commands, since the gap between your setup and theirs is then the next thing to find.

**There is no record that is too small for a comment.** The two cases that look like exemptions are
the ones that most often leave a reporter with an unexplained relabelling, so both have an answer:

- **An open PR already covers it.** Write the comment anyway, and say which PR is in flight and what
  it changes. The reporter does not necessarily see a cross-reference, and "someone has a fix open"
  is the single most useful thing you can tell them. `linked_pr` records that for us; the comment is
  what records it for them.
- **The comment would only restate the thread.** Then do not restate it — write the part that is not
  there yet. What triage concluded, what it checked, and what happens next is never already in the
  thread, because triage is what just produced it. Repeating a maintainer's answer back at the
  reporter reads as automated, but so does silence plus three new labels.

A record staged with an empty `comment` is a bug in the triage, not a shortcut. If you genuinely
cannot think of anything to tell the reporter, you have not finished working out what you think.

Comments are formatted through `oxfmt` with `proseWrap: 'never'` when the record is staged, so hand
wrapping paragraphs is wasted effort — write them as single-line paragraphs and let `stage` normalise
tables and spacing. It leaves the blank lines inside `<details>` alone, so the collapsed block above
survives formatting.

Do not call `gh issue edit` or `gh issue comment` yourself. Every mutation goes through
`.claude/tools/triage`, which holds it in a reviewable record until a human approves it.

**Stage each issue the moment you have decided it — not in a batch at the end.** Finish an issue's
analysis, write its record, move to the next. Three reasons, and all of them bite in a 46-issue sweep:

- **The reasoning is freshest right after you do it.** Deferring the writes means reconstructing forty
  verdicts at the end, which is where a rationale drifts from the evidence that produced it.
- **The reviewer works in parallel with you.** The TUI reloads as records land, so they can approve
  the first ten while you are still reading the twentieth. Batching makes them wait for the slowest
  issue in the queue before seeing anything at all.
- **An interrupted sweep keeps its work.** Context running out, a failed fetch, or the user stopping
  you all leave everything decided so far on disk and reviewable. A batch write at the end loses it.

Write the payload to `/tmp/triage-<N>.json` with the Write tool, then feed it in:

```json
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
```

```bash
.claude/tools/triage stage < /tmp/triage-36863.json
```

Always stage from a **file on stdin**, never with `--json '<inline>'`. Comment prose carries
backticks and quotes, and argv is not a safe place to carry either. Write the file with the Write
tool rather than a `cat` heredoc — `allowed-tools` grants `Write(/tmp/**)` precisely so a payload
cannot be written anywhere else.

`close_reason` is empty for most records. Set it to `completed`, `not planned` or `duplicate` to
propose a close; `linked_pr` records a PR already targeting the issue (Step 3).

The tool refuses to stage a record that sets `stale` or `outdated`, that starts two stale countdowns
at once, that adds and removes the same label, or that closes an issue without a comment — so those
guardrails hold even when this document is only skimmed.

Tell the user as soon as the first few records exist, rather than at the end — that is their cue to
start reviewing while you keep working:

```bash
.claude/tools/triage list
```

> Staging as I go; 3 ready so far. The TUI refreshes as more arrive.

`review` is a TUI: `a` approves, `x` rejects, `c` leaves a note back to you, `o` opens the issue on
GitHub, `e` opens the record in `$EDITOR` so they can fix a label or rewrite a comment directly.
**The user drives it** — but you can put it in front of them instead of making them type it.

### Hand it over, and stop polling

Invoke the **`triage-review-pane`** skill. It opens `triage review` in a side pane under herdr or
tmux, arms the watcher that reports each decision back as a notification, and explains the situation
plainly when neither multiplexer is running. It also covers pushing into a live TUI with
`triage notify`.

Do not hand-roll the split or poll `triage list` in a loop — that is the whole reason the skill
exists.

### Circling back

Decisions arrive one at a time, and you act on each as it lands rather than waiting for the queue:

```bash
.claude/tools/triage feedback     # what they asked you to change, and why
.claude/tools/triage apply        # applies only the records they approved
```

**Apply as approvals arrive — an approval is the go-ahead for that record.** `apply` only ever touches
approved records, so calling it with two approvals in hand is as safe as calling it with forty. On a
long sweep, deferring means a record the reviewer signed off on an hour ago is still sitting unapplied
because someone else's issue is still open in the TUI. Applied records archive themselves out of the
review list, so the pending count keeps shrinking as you go.

`apply --dry-run` prints the exact `gh` commands without running them. Use it whenever you are unsure
what a record resolves to.

#### Answer feedback in subagents, one per issue

**Do not work through the feedback list inline.** Each note is an independent piece of work — re-read
one issue, revise one record — and doing them in the main thread blocks the conversation behind a
queue of them while the reviewer is still going. Dispatch one subagent per issue that has a note, in
parallel:

```
For each issue in `triage feedback`, dispatch a subagent with:
  - the issue number and the reviewer's note, verbatim
  - the current record (`.claude/tools/triage show <N>`)
  - instructions to re-read the issue, revise the judgement, and RESTAGE with
    `.claude/tools/triage stage < /tmp/triage-<N>.json`
  - the reminder that restaging preserves the note, so it can check its revision
    against what was actually asked
```

Why one per issue rather than one agent for all of them: they share no state — each writes a different
record file — so they parallelize cleanly, and a subagent that misreads one note cannot corrupt the
others. It also keeps each agent's context to a single issue, which is the whole reason its judgement
is worth more than a tired pass over forty.

What stays in the main thread: reading `triage feedback` to see what came back, dispatching, and the
final `apply`. **Never dispatch the apply** — that is the step that writes to GitHub, and it stays
where the human can see it.

The reviewer keeps working while this happens. Restaged records appear in their TUI as the subagents
finish, since it reloads as the directory changes.

### Do not clear the state directory

`.nx-issue-triage/` holds other people's staged work as well as yours, and it is gitignored, so there
is no history to fall back on. Never `rm -rf` it — not to reset, not to set up a test. Use
`triage rm <N>` for one record, `triage prune` for settled ones, and **`TRIAGE_DIR=/tmp/...`** when you
need a scratch queue to try something against.

If records do go missing, every write is journalled outside that directory:

```bash
.claude/tools/triage recover --list    # what the journal can restore, and what is already present
.claude/tools/triage recover           # restores only the records that are MISSING
```

The journal carries status and any feedback note, which a re-stage from a saved payload cannot.

Close by reporting what actually changed: issues staged, what the user approved or rejected, blockers
applied and removed, reproductions run and their outcomes, and anything you left alone and why.
