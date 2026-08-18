---
name: grill-me
description: Grill the user relentlessly about a plan, design, decision, or set of review findings — working the decision tree in rounds until nothing is left silently assumed. Use when the user wants to stress-test their thinking, says "grill me", or when another skill (for example /review-pr) delegates its evaluation pass here.
allowed-tools: Read, Grep, Glob, Bash(git -C *), Bash(git log *), Bash(git diff *), Bash(git show *), Bash(gh pr view *), Bash(gh issue view *), Agent, AskUserQuestion, Edit(*), Write(*)
---

Interview the user relentlessly until you reach a shared understanding. Map the subject as a **design tree**: every decision branches into the decisions that hang off it.

Work the tree in **rounds**. The **frontier** is every decision whose prerequisites are already settled — the questions you can ask _now_ without guessing at answers you haven't heard yet. Ask the whole frontier in one round: number each question and give your recommended answer. Then wait for the user's answers before the next round.

Format each question like so:

```
❓ **Q1** - **<question title>**: <question body, may be several paragraphs, including any choices>

➡️ <your recommended answer>
```

Each round of answers reshapes the tree — settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round. A question whose answer depends on another question still open in this round belongs to a _later_ round, not this one.

Finding _facts_ is your job, never the user's. When a frontier question needs a fact from the environment, dispatch a sub-agent to find it — never ask the user for something you could look up. Don't block on it: a running exploration is an unsettled prerequisite, so only the questions downstream of it wait: ask the rest of the frontier now. The _decisions_ are the user's — put each to them and wait.

The session is done when the frontier is empty: every branch visited, nothing left silently assumed. Do not act on the outcome until the user confirms you have reached shared understanding.

## Two rules that hold regardless of caller

- **Never answer your own questions.** If a round goes unanswered, stop and leave the subject exactly as it was. A grill that supplies the user's answers manufactures agreement that was never given, and every downstream step that trusts the result inherits the fabrication. Silence means stop, not proceed with the obvious answer.
- **Skip what is already settled.** A question the caller's own material answers is noise. The point is resolving genuine uncertainty, not walking a checklist.

## When a caller delegates a set of findings

**Brief the user before the first question.** Unlike a plan they wrote themselves, findings arrive from agents the user has not read — so state, up front, what was reviewed and the one-line inventory of findings by tier. Then have every question restate the finding it is about, inline, rather than referring to it by number. A question about a defect the user has never seen is unanswerable, and rule one below turns an unanswered question into a full stop — so opening cold does not make the grill cautious, it makes it produce nothing.

Review findings are mostly independent of each other, so the tree is shallow and wide rather than deep. Round it anyway — the dependencies are real, they just sit between _tiers_ rather than between individual items:

1. **Round 1 — the blocking findings.** They gate the verdict, and they are independent of one another, so the whole tier is one frontier.
2. **Round 2 — the rest, plus what round 1 unblocked.** Dropping one finding as pre-existing usually implicates its siblings in the same file or pattern; those questions could not be asked until round 1 landed.
3. **Round 3 — the consequences.** The verdict that follows from what survived, and anything the user's reasoning generalized into a standing rule.

Apply each round's answers before asking the next, rather than collecting everything and acting at the end — the user should be able to stop after any round and keep the value of what is already decided.

**Close by briefing again.** When the frontier is empty, re-render the opening inventory against the post-grill state, showing what moved — dropped, re-tiered, kept — and ask whether it matches what the user decided. Answers are given one round at a time against one item at a time, so nobody tracks the cumulative effect in their head, and the material has been mutating the whole way. This is a confirmation, not another round: do not reopen a settled item or raise something the grill never asked about. If the user's reply opens something genuinely new, that is a new round — grill it properly.

---

The round/frontier method above is adapted from [mattpocock/skills](https://github.com/mattpocock/skills) (`skills/productivity/grilling`), MIT-licensed, © 2026 Matt Pocock.
