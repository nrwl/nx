# Staging, approval and apply

Shared by `triage-issues` and `triage-prs`. Records, the review pane, the feedback loop and the
apply step are identical for both; only the `gh` verbs differ, and the tool handles that from the
record's `kind`.

### Attribute the analysis — don't write in the maintainer's voice

A triage comment is posted from a maintainer's account, so anything you write reads as _their_
technical judgement, permanently and in public. Findings you derived — a reproduction you ran, a
mechanism you read out of the source — must be visibly marked as triage notes rather than blended
into the maintainer's own words.

Put everything triage worked out in a collapsed **Triage notes** `<details>` block, and leave the
actual request to the reporter outside it in plain prose. **The block body is a blockquote** — every
line inside it, after `</summary>`, is prefixed with `>`:

````markdown
Could you confirm whether you see this outside `run-commands` as well?

<details>
<summary>

#### Triage notes (automated triage, reviewed before posting)

</summary>

> Reproduced on 23.2.0-beta.11 from the steps above:
>
> ```
> --output-style=stream -> 5000 lines
> --output-style=static -> 0 of 5000
> ```
>
> Both runs exit 0, so the loss is silent.

</details>
````

The blockquote is what makes an expanded block read as a quoted aside rather than as more of the
maintainer's comment. GitHub gives it a left rule and a muted background, so the seam between what a
person wrote and what triage produced stays visible after someone expands it — which is the whole
point of the split, and which a bare paragraph loses the moment the `<summary>` scrolls off.

**The blank lines are load-bearing.** GitHub only parses Markdown inside `<details>` when the HTML
tags are separated from the content by blank lines. All four matter:

- after `<summary>`, and before `</summary>` — without them the summary renders as literal text,
  backticks, asterisks and all
- after `</summary>` — without it the first paragraph of the body swallows the tag
- before `</details>`

Get one wrong and the comment renders as raw HTML on a public issue, which is not something you can
tidy up afterwards without an edit everyone can see.

**Inside the blockquote, a blank line is `>`, not empty.** A genuinely empty line ends the quote, and
the rest of the block silently falls out of it — which looks fine in a diff and wrong on GitHub. The
two places this bites:

- between paragraphs: the separator line is `>` on its own
- around a fenced code block: the fences are `> ```` and the blank lines above and below them are
`>` too, so the whole fence sits inside the quote

The two blank lines that must stay genuinely empty are the ones bracketing the blockquote itself —
after `</summary>` and before `</details>`. Those are the HTML boundaries, and putting a `>` on them
breaks the parse instead.

Why the split, and why collapsed: the notes carry the evidence and can be wrong without putting words
in the maintainer's mouth, while the plain-prose ask is the human actually asking. Collapsing matters
more than it looks — a reproduction transcript, a version bisect and a source excerpt can run longer
than the issue being triaged, and an unfolded wall of that buries the one sentence the reporter is
supposed to act on. The summary line is what everyone reads; the evidence is there for whoever wants
it.

**Every record gets the block.** The summary line is a disclosure — this comment was written by a
machine and read by a human before it went out — and that is true of a one-line routing note as much
as of a reproduction transcript. A reader cannot tell which comments were worth checking if only some
of them say so, and the ones that quietly omit it are exactly the ones where the omission misleads.

**The comment has to stand on its own.** Someone reading without expanding anything should get the
decision, why it was made, and what to do next. If they have to open the block to understand the
comment, the comment is wrong. That rules out the tempting arrangement where the prose is a
pleasantry and the reasoning hides in the fold.

**The test for what goes where is what the reader would be doing with it.** The open prose carries
what they need in order to accept the decision and act on it. The block carries what they would need
in order to **challenge** it. That is a sharper line than "summary and detail", and it decides the
cases that otherwise feel arbitrary:

- "Superseded by #36715, which added X" is in the open. It is the reason, and without it the close is
  just an assertion.
- "Checked by reading the source on master, not by matching commit titles, and here are the two paths
  to confirm it against" is in the block. It adds nothing to someone accepting the close, and it is
  the first thing someone disputing it would want.
- A reproduction verdict is in the open. The numbered steps that produced it are in the block.

It also settles the repetition problem on its own. Once the reason is in the open, restating it in
the fold at higher resolution has nothing left to add, and a reader reasonably asks why the comment
says the same thing twice.

**Length is the other half of the constraint, and the fold is how you get both.** What the reporter
wants in the open is that it reproduces and someone will look. What they must not get in the open is
a wall of steps, versions and command output, which is unpleasant to scroll past on your own issue.
Neither means the detail is unwelcome. It means it goes behind the summary line, which is the whole
reason the block exists.

So: the verdict in the open, one line of it. The full derived reproduction inside the block, at
whatever length it honestly takes.

**It is a handoff, not an audit trail of triage.** How the rotation landed on someone, which guidance
overrode which draw, what a name was picked over: none of that helps the person picking the PR up, and
in public it reads as the process talking about itself. That goes in `rationale`, which only the
reviewer sees.

What belongs in the block, when there is anything:

- the derived reproduction in full: numbered steps, the commands, the versions, what each arm
  produced. On an issue this is usually the whole block and the reason it exists.
- a related PR or issue and what to check about it
- why a label went on, in the words a person would use. "Added `blocked: needs rebase` because the
  branch conflicts with master" beats a restatement of the `mergeable` field.
- outstanding review state a newcomer would miss, such as change requests still open
- a qualification on something claimed in the prose

**A thin block is fine. An absent one is not.** Every record carries it, because the summary line is
the disclosure that a machine wrote this comment and a human read it before it went out, and that is
as true of a one-line record as of a reproduction. When a routine record has only "added
`blocked: needs rebase` because the branch conflicts with master" to hand over, that is the whole
block and it is doing its job. What you must not do is pad it back up to look substantial.

What does _not_ go in the block is anything that would read badly in public — an assessment of a
colleague's bandwidth, a preference about who gets which work. Say that in `rationale`, which only
the reviewer sees.

**Keep the open prose short. Usually it is courtesy, not content.**

The block already says who is assigned and why, what CI reported, and how the PR is linked. Restating
any of that above it in a maintainer's voice adds nothing, and it manufactures a considered-sounding
human sentence out of what was a table lookup. On a routine record the open prose is a brief thank
you and a note that someone will review as time allows. Nothing more:

> Thanks for the PR. Assigned now, and someone will review it as time allows.

On a maintainer's own PR, drop the thanks and say the state:

> Assigned. Ready for review whenever there's a slot.

**Never leave the block alone with no prose above it.** Someone opening the issue then sees a single
summary line and nothing else, which reads as a bot dropping an artifact on their thread. That is the
exact impression the attribution split exists to avoid.

**Three cases earn real prose, because the record does something the author has to answer.** Here the
open prose carries the ask and the block stays evidence:

- **A close.** The reason goes in the open, in full, with the route back in. `triage-prs` is explicit
  that a close with no explanation on a first-time contributor's PR is the most expensive thing this
  workflow can produce, and a reason folded into a collapsed block is a close with no explanation.
- **A draft.** The author has to push a fix and mark it ready, so say that and name what failed.
- **A specific request.** A missing `Fixes #NNNNN`, a file that looks like it should not ship, a
  question only they can answer. One request per comment.

Outside those three, if you find yourself writing a third sentence in the open, it belongs in the
block.

### Silence is an option on a PR, and never on an issue

**On an issue, every record carries a comment.** A reporter watching their bug collect a priority and
an assignee with no word about what was found cannot tell considered triage from a bot relabelling
their thread, and has no way to push back on a call they think is wrong. That is the rule below and it
has no exemptions.

**On a pull request it can be noise.** A maintainer's own PR, assigned to them, with green CI and
nothing blocking it, does not need a comment saying so. They can see the labels and the assignee, and
a note telling them what they already know is clutter on their own thread. The same holds where a
reviewer is already engaged and the conversation is live: a triage note lands in the middle of it and
adds nothing.

Stage those with an empty `comment`. The record still carries its labels, its assignee and its
`rationale`, and `apply` simply skips the comment step.

**A maintainer already in the thread raises the bar a lot.** When someone from the team has commented
or reviewed, the contributor is in a live conversation and a triage note interrupts it. Almost
everything a routine record would say is already known to both of them: who is looking at it, that it
is assigned, that a review is coming.

What survives is only what the record itself _does_ and the thread does not already know. CI being
approved and starting. A `blocked:` label going on and why. A duplicate or superseder nobody has
mentioned. Drop the thanks, drop "assigned now", drop "someone will review as time allows". They know.

**The assignee is almost always that maintainer**, not the rotation's pick. They are already holding
it, and routing it elsewhere invents a second owner for a conversation that is underway. This is the
continuity rule in `owners.md`, and an engaged maintainer is the strongest form of it.

**Say something whenever the record asks anything of the author or tells them something they cannot
see.** The tool refuses an empty comment on a record that converts the PR to a draft, approves CI
runs, or adds a `blocked:` label, because each of those is a change the author has to respond to. Use
the same judgement for the cases it cannot check: a close, a duplicate or superseder worth pointing
at, an outstanding review the author may have missed, a missing `Fixes #NNNNN`, a question only they
can answer.

The test is whether a person reading it would learn anything. If not, the honest record is the one
that says nothing.

### Every record carries a comment — this is the issue rule

**If you are changing anything on the issue, say why on the issue.** A reporter watching their bug get
a `priority: low` and an assignee, with no word about what was found, has no way to tell considered
triage from a bot relabelling their thread — and no way to push back on a call they think is wrong.

**The `repro` field is what the block is built from.** It already holds what you ran, on which
versions, and what came back, which is exactly what the reporter cannot see. Turn it into the Triage
notes block rather than writing a second account from scratch, keeping the numbered steps, the
commands and what each arm produced. Where a run contradicted part of the report, or ruled out a
theory from the thread, say so there, because that is the part that saves them a debugging session.

In the open prose, one line: it reproduces on such-and-such, or it does not and here is the gap.
Nothing more. The steps are behind the fold for whoever wants to check them.

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
  "author": "jcaracciolo",
  "author_assoc": "FIRST_TIME_CONTRIBUTOR",
  "repro": "**Reproduced** on 23.1.1, nx-examples, Node 22.\n\n1. `git clone https://github.com/nrwl/nx-examples && pnpm install`\n2. Add a `noisy` target running `echo started; { sleep 1; yes PAYLOAD | head -n 5000; } &`\n3. `nx run-many -t keepalive --outputStyle=stream | grep -c PAYLOAD` -> 5000\n\n**Control** (the arm that behaves correctly):\n\n1. Same workspace, `--outputStyle=static`\n2. `nx run-many -t keepalive | grep -c PAYLOAD` -> 0, exit 0 either way",
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

### Always record the author

`author` and `author_assoc` come straight from the payload you already fetched
(`authorAssociation`). They drive a badge in the review pane — **TEAM** for
`OWNER`/`MEMBER`/`COLLABORATOR`, **NEW** for `FIRST_TIME_CONTRIBUTOR`/`FIRST_TIMER`, and nothing for
an ordinary `CONTRIBUTOR`, because a badge on almost every row stops being a signal.

Fill them on every record, issue or PR. They are what tells the reviewer, at a glance down the queue,
which rows are somebody's first contribution — and that is the fact most likely to change how a reply
should be written before it is approved.

### Writing `repro`

**`repro` is a numbered list of the steps actually taken, not a paragraph.** It lands in the record's
`## Reproduction` section, so it renders as markdown and can carry lists, code spans and paragraph
breaks — a prose blob arrives as an unreadable wall, which is what it used to do when this field was
a YAML scalar.

- Lead with the verdict and the environment in one line: reproduced or not, on which version, on what.
- Then the numbered steps, each one a command or a concrete edit, in the order you ran them.
- **One list per path tested.** If you ran a control, or a second version, or a variant that behaved
  differently, each gets its own heading and its own list. A single merged list hides which arm
  produced which result, and the whole value of the control is that the two are comparable.
- Say what each arm produced, not just what you ran. `-> 5000` and `-> 0` are the finding.

Newlines go in the JSON as `\n`; the tool writes them into the body verbatim.

`close_reason` is empty for most records. Set it to `completed`, `not planned` or `duplicate` to
propose a close; `linked_pr` records a PR already targeting the issue (Step 3).

The tool refuses to stage a record that sets `stale` or `outdated`, that starts two stale countdowns
at once, that adds and removes the same label, that closes an issue without a comment, or whose
comment contains an em or en dash. Those guardrails hold even when this document is only skimmed,
which is the point of putting them in the tool rather than here.

Tell the user as soon as the first few records exist, rather than at the end — that is their cue to
start reviewing while you keep working:

```bash
.claude/tools/triage list
```

> Staging as I go; 3 ready so far. The TUI refreshes as more arrive.

`review` is a TUI: `a` approves, `x` rejects, `c` sends the record back to you for changes, `n` leaves
you a note that decides nothing, `o` opens the issue on GitHub, `e` opens the record in `$EDITOR` so
they can fix a label or rewrite a comment directly.
**The user drives it** — but you can put it in front of them instead of making them type it.

`c` and `n` are different channels and must not be collapsed. `c` means "this record is wrong" — the
status becomes `changes-requested` and nothing applies until it is restaged and approved again. `n`
means "and also do this" — a Linear ticket to file, a person to ping — and touches nothing about the
staged mutations, so a record can be approved and carry a note at the same time.

`x` is final: a rejection archives on the spot and drops out of the review list, the same way `apply`
retires a record it has written to GitHub. It is still there under `triage list --all` and
`triage show <N>` — the record is the only account of what was decided — but it will not come back
round for a second look, so do not use `x` where `c` is meant.

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
.claude/tools/triage notes        # side requests, which block nothing
.claude/tools/triage apply        # applies only the records they approved
```

A note is not a gate. Act on it as ordinary work in the main thread and apply the record on its own
schedule — holding an approved record back until you have filed the Linear ticket the note asked for
is exactly the coupling `n` exists to avoid.

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
