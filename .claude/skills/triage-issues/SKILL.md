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

**Record it as steps, not prose.** The `repro` field becomes the record's `## Reproduction` section,
so it takes a numbered list of what you actually ran — one list per path tested, with what each arm
produced. The control arm above is only worth running if the record shows both arms side by side.
Format and example: `.claude/skills/triage-shared/staging.md`.

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

**Every record carries an assignee. There is no "leave it unassigned" outcome.** An issue with a scope
label but no owner is still nobody's job.

The procedure — the owners table, the rotation and its guidance, the git-history fallback, and the
rules for when a linked PR decides the owner — is shared with PR triage and lives in
**`.claude/skills/triage-shared/owners.md`**. Read it; do not reimplement it from memory.

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

Staging, the review pane, the feedback loop and the apply step are shared with PR triage and live in
**`.claude/skills/triage-shared/staging.md`**. Read it before writing any record.

The short version, so this page stands alone: write the payload to `/tmp/triage-<N>.json` with the
Write tool, `.claude/tools/triage stage < …` it **as soon as you have decided that issue**, tell the
user early so they can review while you keep going, then `triage feedback`, `triage notes` and
`triage apply` once they have been through the queue. Nothing reaches GitHub without a human approving it.
