---
name: triage-prs
description: >-
  Triage open pull requests in nrwl/nx. Decides who handles a PR, converts it to a draft when CI is
  red, checks for a linked issue (GitHub or Linear), and judges whether an unlinked community PR
  should stay open at all. Produces a plan you approve before anything is written to GitHub. This is
  NOT a code review — use review-pr for that. Use on "triage this PR", "triage open PRs", "which PRs
  need an owner", "should we close this PR", "is this PR ready for review".
allowed-tools: Agent, Bash(.claude/tools/triage *), Bash(TRIAGE_DIR=* .claude/tools/triage *), Bash(gh pr view *), Bash(gh pr list *), Bash(gh pr checks *), Bash(gh api graphql *), Bash(gh api repos/nrwl/nx/*), Bash(gh search issues *), Bash(head *), Read, Grep, Glob, Write(/tmp/**), Skill
argument-hint: '[<pr number or url> ...]  (no args: sweep unowned open PRs)'
---

# Triage an nx pull request

Decide **who handles this PR, whether it is ready to be looked at, and whether it should exist**.
Then stage those decisions for a human to approve.

## This is not a review

Do not run `review-pr`. Do not check the branch out. Do not judge the implementation, the test
coverage, or the approach. That is the assignee's job _after_ triage, and doing it here costs the
expensive part of a review while burying the cheap decision this workflow exists to make.

The one judgement about content you do make is **whether the change should be on the table at all**
(decision 3 below), and that turns on who opened it and whether anyone agreed to it — not on whether
the code is good.

## Shared with issue triage

These are identical for issues and PRs, and live in one place so a correction lands once:

- **`.claude/skills/triage-shared/owners.md`** — the owners table, the rotation and its guidance, the
  git-history fallback, and how a linked PR decides the owner.
- **`.claude/skills/triage-shared/staging.md`** — records, the review pane, the feedback loop, the
  apply step, and the rules about never clearing the state directory.

Read both. The rest of this page is only what differs for a pull request.

## 1. Find the ones that need it

An open PR is untriaged when nobody owns it. Drafts are excluded — a draft is already out of the
queue, which is the state this workflow puts failing PRs _into_:

```bash
gh pr list --repo nrwl/nx --state open --limit 300 --draft=false \
  --json number,title,author,assignees \
  --jq '[.[] | select(.assignees | length == 0)][].number' > /tmp/untriaged-prs.txt
```

## 2. Fetch them in one call

Same shape as issue triage — one aliased GraphQL query rather than a `gh pr view` per PR:

```graphql
fragment P on PullRequest {
  number
  title
  isDraft
  author {
    login
  }
  authorAssociation
  assignees(first: 5) {
    nodes {
      login
    }
  }
  labels(first: 20) {
    nodes {
      name
    }
  }
  mergeable
  mergeStateStatus
  closingIssuesReferences(first: 5) {
    nodes {
      number
      title
    }
  }
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          state
        }
        checkSuites(first: 30) {
          nodes {
            status
            conclusion
            app {
              slug
            }
            workflowRun {
              workflow {
                name
              }
            }
          }
        }
      }
    }
  }
  body
}
```

**`statusCheckRollup.state` alone is not the CI verdict, and trusting it is a live bug.** It does not
count a suite whose conclusion is `ACTION_REQUIRED`, so a fork PR whose workflows have never been
allowed to start still rolls up as `SUCCESS` off a third-party check such as `socket-security` or
`netlify`. Measured on one sweep of the open queue, 19 of 82 PRs rolled up `SUCCESS` while the `CI`
workflow sat unapproved. `checkSuites` is what tells the two apart, which is why it is in the query.

`closingIssuesReferences` only populates for real closing keywords (`Fixes #N`), which is the
point: a PR that merely _mentions_ an issue has not linked it.

## 3. The seven decisions

### Has CI run, and did it pass?

Two questions, in that order. A red PR is not ready for a reviewer's time, and a PR that was never
built is not ready either. It just looks readier.

**Count the GitHub Actions check runs on the head commit. If it is zero, the rollup means nothing,
whatever it says.** `statusCheckRollup` aggregates check _runs_, not check _suites_. An Actions suite
that produced no check runs contributes nothing to it, so the rollup falls through to whatever
third-party checks remain, which on a fork PR is usually a green `socket-security` or `netlify`. That
one mechanism produces every false green below:

| what happened                | suite conclusion  | Actions check runs | rollup says |
| ---------------------------- | ----------------- | ------------------ | ----------- |
| never approved               | `ACTION_REQUIRED` | 0                  | `SUCCESS`   |
| no workflow ever ran         | no suite at all   | 0                  | `SUCCESS`   |
| failed before emitting a run | `FAILURE`         | 0                  | `SUCCESS`   |

Measured on one sweep: **48 of 82 open PRs rolled up `SUCCESS` with zero Actions check runs, and only
18 had genuinely passed.** Three were the last row, green in the rollup and failed underneath.

So query `checkSuites { conclusion checkRuns { totalCount } app { slug } }` and decide from that:

- **Zero Actions check runs, and a suite at `ACTION_REQUIRED`** → CI is waiting on a maintainer, not
  on the author. Record `"ci": "AWAITING_APPROVAL"` and propose `"approve_ci": true`. Do **not**
  draft it. Nothing has failed, and the person who has to act is us. Approving is part of triage,
  because a PR nobody has allowed to build is a PR nobody can review, and it can sit that way for
  months.
- **Zero Actions check runs, and a suite at `FAILURE`** → the workflow failed before it produced any
  check runs. Record `"ci": "FAILED_TO_START"` and propose `"draft": true`. This is a real failure
  wearing a green rollup, so say in the comment that the rollup is misleading.
- **Zero Actions check runs, and no Actions suite at all** → on a fork PR this is almost always an
  **expired approval**, not a mystery. Record `"ci": "APPROVAL_EXPIRED"`. Do not draft it and do not
  call it failed, and do not set `approve_ci`: there is no run left to approve, so it would resolve to
  nothing. What it needs is a push, and if the branch also conflicts the rebase it already needs is
  that push.

  GitHub deletes a workflow run that sits at `ACTION_REQUIRED` for about 30 days. So this state and
  `AWAITING_APPROVAL` are one condition at two ages, and the boundary is sharp. Measured on one
  sweep: every fork PR with a head commit 24 days old or newer still had an approvable run, every one
  36 days or older had none, nothing fell in between across 49 PRs, and 442 of the repo's 444
  pending runs were 29 days old or younger. The control is that 7 fork PRs older than 36 days did
  still have runs, all of them approved and executed at the time, because a run that executes
  persists.

  **This is the argument for approving during triage rather than leaving it.** On that sweep 49 of 82
  unowned open PRs had never been built, and 30 of them were already past the point where anyone
  could approve them.

- **`FAILURE`** → propose `"draft": true`, and name the failing **tasks**, not the checks.

  ```bash
  .claude/tools/triage ci-tasks <N>     # -> nest:test
  ```

  GitHub only names the workflow. On this repo that is `main-linux`, or a 90-character
  `affected --targets=...` string, and neither tells a contributor what broke. `ci-tasks` resolves the
  Nx Cloud pipeline behind the check and prints the failing task ids on stdout, with the cache status
  and run status on stderr. Put the task name in the **open prose**, since it is what the author acts
  on.

  The verb owns the credential, the server URL and the lookup chain, so do not improvise any of it.
  Three things it handles that are easy to get wrong by hand: an Nx Cloud pipeline cannot be found by
  a fork PR's head ref, because the branch is recorded as the pull request **number**; an aged-out
  pipeline returns 404 and means the data is gone rather than that nothing failed; and a run group
  with a `criticalErrorMessage` failed as infrastructure, so naming tasks would blame a contributor
  for our own breakage.

  It needs a credential. `nx login --status` from the workspace root says whether one is present, and
  `nx login` is interactive, so ask rather than running it yourself. Without one the verb says so and
  exits non-zero, and the honest fallback is to name the workflow and say the task names were not
  retrievable.

- **`PENDING`** → do not draft. A PR mid-run is not a red PR.
- **`SUCCESS` with at least one Actions check run** → the only case where green means green.

`approve_ci` runs contributor-authored code on our runners, so it is staged and human-approved like
every other mutation here. `apply` resolves the run ids at apply time rather than reusing ones
captured at staging, because any push to the PR supersedes them, and approving a stale id is a silent
no-op that still lets the comment claim CI is running.

The tool refuses a record that sets `approve_ci` alongside `ci: SUCCESS` or `ci: FAILURE`. Those
describe two different moments. If the run has not been allowed to start, its outcome is not knowable
yet, and asserting it is the exact mistake this field exists to prevent.

**CI moves while you triage.** A sweep of 80 PRs takes long enough that runs start, finish and get
superseded by a push underneath you. The `ci` field is a snapshot, not a promise, and a record staged
an hour ago can be stale by the time it is approved. Re-check anything whose CI state decides the
action, especially a draft, immediately before applying it.

**A draft means the ball is with the author, and red CI is only one reason for that.** Anything the
author must do before a reviewer can usefully look is grounds for it: files in the diff that were
never meant to ship, a change that is really two changes and needs splitting, a branch that cannot be
read against current `master`. Draft it, say plainly what has to change, and let them mark it ready.

Say it as a statement, not a question. "Were these meant to ship?" invites a reply and leaves the PR
sitting in the queue; "these should not ship, please drop them" is actionable and can be. A question
is right when you genuinely do not know, and wrong when you do.

Never draft a PR that is **already** `isDraft`. Check first, or the record applies a no-op while the
comment claims something that did not happen.

### Can it merge?

A conflicting PR is not reviewable. The reviewer cannot see what the change actually does against
current master, and the author has work to do that no review will tell them about.

- **`mergeable: CONFLICTING`** → add `blocked: needs rebase`, which this repo already carries for
  exactly this, and record `"mergeable": "CONFLICTING"`. Ask for the rebase in the open prose. This
  is one of the cases where the open prose earns real content, because the author has to act.
- **`mergeable: MERGEABLE`** → nothing to do.

**`mergeable` is computed lazily, and the first query always lies.** GitHub returns `UNKNOWN` and
only _schedules_ the computation, so a single pass over a queue reports `UNKNOWN` for roughly half of
it and finds no conflicts at all. Query, then query the `UNKNOWN` ones again. On one sweep the first
pass returned 40 `UNKNOWN` out of 82 and the retry resolved every one, taking the conflict count from
16 to **35**. The tool refuses to stage `mergeable: UNKNOWN` for this reason, and refuses
`CONFLICTING` without the label.

Add `mergeable` and `mergeStateStatus` to the Step 2 fragment. `mergeStateStatus` is the finer
signal: `DIRTY` is a real conflict, `BEHIND` only means the branch is out of date, and `BLOCKED`
usually means a required check has not passed rather than anything wrong with the branch.

### Is there a linked issue?

Check in order:

1. `closingIssuesReferences` — a real GitHub link.
2. The body for a Linear reference: an `NXC-####` key or a `linear.app/…` URL. **Linear links through
   the branch name or a body reference, not GitHub's own field**, so a Linear-tracked PR shows nothing
   in step 1 and looks unlinked if you stop there.
3. Neither → unlinked; go to the next decision.

### No linked issue — should this PR exist?

This is the judgement, and it turns on who opened it:

- **A maintainer's PR needs no issue.** They have the context; the PR is the record.
- **A community PR with no issue leans towards closing.** Not because the code is wrong, but because
  nobody agreed the change should be made, and merging it commits the team to maintaining behaviour
  nobody asked for. Close with a comment that says exactly that and points at Discussions or an
  issue, so the author can come back with agreement rather than a rejected diff.
- **Unless it is a clear win.** A one-line fix to an obvious bug, a typo, a dependency bump closing a
  CVE, a docs correction. The test is whether the change is self-evidently **correct** _and_
  self-evidently **wanted** — both, not either. If you would merge it without discussion, do not make
  the author file an issue first.

A close with no explanation on a first-time contributor's PR is the most expensive thing this
workflow can produce. The comment does the work; `references/replies.md` in `triage-issues` has the
voice to use.

### Has it just gone cold?

A maintainer's own `chore` PR that nobody has touched for months is not waiting on anything. There is
no reporter to disappoint, no contributor left hanging, and the author can reopen it in one click if
they still want it. Leaving it open costs a slot in every future sweep; closing it costs nothing.

Close it when all of these hold:

- the title is a `chore` (housekeeping, not a fix or a feature someone is waiting on)
- the author is a maintainer
- nothing has touched it for months, measured on `updatedAt` rather than when it was opened

Say in the comment that it went cold rather than that it was rejected, and that reopening is fine.
The decision is "this is not happening right now", not "this was wrong".

**Do not apply this to a community PR.** A contributor cannot read a close as housekeeping, they read
it as a rejection, and they have no standing to reopen. For those, the unlinked-PR judgement above is
the one that applies.

Drafting a cold chore is the wrong move even when CI is red. A draft is for work that is coming back,
and it just moves the PR out of sight without resolving it.

### Has it already been done?

An old PR can be correct, green and pointless, because the thing it asks for landed while it waited.
Closing it is kinder than leaving it open, and cheaper than a review that ends the same way.

Two places to look, both cheap:

**Master, since the PR was opened.** Take the PR's changed files under `packages/` and list the
commits that have touched those same files since:

```bash
CREATED=$(gh pr view <N> --repo nrwl/nx --json createdAt -q '.createdAt[0:10]')
git log --since="$CREATED" --format='%an | %s' --no-merges -- <the PR's changed files>
```

File overlap alone proves nothing. It is why the PR conflicts, not evidence that it is redundant, and
on one sweep 42 of 79 open PRs had it. Filter out the repo-wide sweeps (`chore(repo)`, `chore(misc)`,
the codemods) and compare **intent**: does a commit subject describe the same change the PR title
does? That is the signal. On the same sweep, scoring shared words between the PR title and those
commit subjects narrowed 42 candidates to 7, of which most were coincidence and one was real.

**The rest of the open queue.** Compare titles and touched paths across the PRs you are triaging.
Duplicate pairs do not cross-reference each other, so nothing surfaces them except looking. One sweep
found two pairs this way, both fixing the same defect at different layers.

**Ask the linked issue what else references it.** This is the cheapest and best of the three checks,
and it catches what the other two structurally cannot:

```bash
gh api graphql -f query='query { repository(owner:"nrwl",name:"nx"){ issue(number:<N>){
  timelineItems(first:20, itemTypes:[CROSS_REFERENCED_EVENT]){ nodes{ ... on CrossReferencedEvent {
    source { ... on PullRequest { number state isDraft title author{login} } } } } } } } }'
```

Step 1 of this workflow filters to PRs with **no assignee**, so an assigned maintainer PR is never in
your dataset, even when it targets the same issue as something you are triaging. The master scan does
not see it either, because it has not landed. Only the issue knows about both.

Measured: #36043 from a contributor and #36651 from a maintainer both close #36036, and neither PR
mentions the other, so nothing on either thread showed it. The sweep found nothing until the issue was
asked.

**In-flight overlap is not supersession, but it is not triage's call either.** An open or draft PR
covering the same ground has not landed, so triage must not close on it unilaterally. Say it in the
open prose, because the contributor needs to know their review may end in a close through no fault of
the diff, and assign the person driving the other PR.

They can then decide it supersedes, and that is a legitimate call triage was not entitled to make.
When it goes that way, two things change from the merged case:

- **The linked issue stays open.** Nothing has fixed it yet. Closing it alongside would tell the
  reporter their problem was solved when it has not been.
- **Say plainly that the other PR is unmerged**, so the close reads as a decision about which shape
  to carry forward rather than as a verdict on the contributor's diff. They did real work and lost to
  a scheduling decision, which is a different thing from being wrong.

**A superseded PR usually means a resolved issue.** If the PR you are closing has a linked issue, the
merged work that superseded the PR has probably satisfied that issue too, and leaving it open strands
a request that has already been met. Read the issue, and if the landed work covers it, stage a second
record closing it.

The close reasons differ, and the difference is the whole point:

- The **PR** closes `not planned`. This implementation is not the one that landed.
- The **issue** closes `completed`. The thing being asked for was in fact done.

Give the issue its own comment naming the PR that delivered it and the version it shipped in, which is
what the reporter actually needs. `git tag --contains <sha>` gives you the version.

Read the issue before doing this rather than assuming it. An issue can ask for more than the PR would
have delivered, in which case it stays open and the comment says what is still missing.

**Verify before you close.** A title match is a candidate, not a verdict. Read the PR's diff and the
current state of the same code, and quote what you found. Closing a working PR on a wrong guess is
the most expensive mistake available here, and the author has no way to tell a considered close from
a careless one. When it is genuinely superseded, name the PR that replaced it and what it added, so
the author can check for themselves and file an issue for anything it missed.

### Who handles it?

Follow `triage-shared/owners.md`. The assignee is **whoever is accountable for getting this PR over
the line**, which is not the same question as who reviews it:

- **A maintainer's own PR is assigned to them.** They are already the person driving it to merge.
  Routing it to a co-owner "because an author cannot review their own work" invents a second owner
  for work that is already spoken for, and leaves the author's name off the thing they are actually
  responsible for. Finding a reviewer is their job, and it happens after triage.
- **A community PR goes to the scope owner** — the maintainer who will review it, ask for what it
  still needs, and merge it. Never the contributor, who cannot do any of those things.
- **Continuity beats the rotation either way.** A maintainer who has already reviewed a community PR
  owns landing it.

This is the same rule `owners.md` already applies from the issue side, where a linked PR authored by
a maintainer assigns that maintainer. Do not read "an author is never their own reviewer" — true, and
irrelevant here — as a reason to route a maintainer's PR elsewhere.

It also dissolves a routing dead end: `scope: repo`, `scope: devkit`, `scope: plugins` and
`scope: dotnet` each have exactly one configured owner, so excluding the author left those rows unable
to produce anyone at all.

## 4. Stage it

```json
{
  "issue": 36846,
  "kind": "pr",
  "title": "fix(core): handle scoped outputs",
  "add_labels": ["scope: core"],
  "assign": "FrozenPandaz",
  "author": "StalkAltan",
  "author_assoc": "MEMBER",
  "ci": "FAILURE",
  "linked": "none",
  "draft": true,
  "comment": "…",
  "rationale": "…"
}
```

`kind: "pr"` is what routes the apply step to `gh pr edit` / `gh pr ready --undo` / `gh pr comment` /
`gh pr close`. It is validated, not coerced: a typo fails loudly rather than quietly applying _issue_
verbs to a pull request.

`ci` and `linked` are recorded rather than re-derived so the reviewer approving a draft-or-close sees
the evidence the judgement rested on without going to GitHub.

The record number is the PR number. GitHub numbers issues and PRs from one sequence, so a PR record
and an issue record can never collide, and both appear in the same queue and the same review pane.

Everything from here — staging as you go, the review pane, feedback, apply — is
`triage-shared/staging.md`.
