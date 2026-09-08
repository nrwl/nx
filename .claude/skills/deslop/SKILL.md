---
name: deslop
description: Check and fix prose that leaves this repo for a human reader, so it does not read as machine-written. Enforces the punctuation rules in astro-docs/STYLE_GUIDE.md and the banned-phrase lists in the committed vale styles, on the surfaces vale never runs against. Use before posting or handing over any text another person will read - a PR description or PR comment, an issue reply, a code-review comment, a triage comment, a release note, a commit message body, a design note, a README. Also use when asked to de-slop, unslop, tidy or humanize prose, when text "reads like AI wrote it", or when someone says it is too wordy, too polished, or not how they would say it. Not for astro-docs content, which has its own check - use check-docs-style there.
user-invocable: true
argument-hint: '[path or -] - files to scan, or pipe the draft on stdin'
---

# deslop

Nx already bans the loudest tells. `astro-docs/STYLE_GUIDE.md` forbids em dashes, en dashes and
semicolons, and `astro-docs/.vale/styles/Nx/` lists 60-odd banned phrases. But vale only runs on
`astro-docs/**`, so none of it covers the text agents actually send outward: PR comments, issue
replies, review notes, PR descriptions. This closes that gap using the same committed rules.

## Quick start

```bash
# a draft you have not written to a file yet
printf '%s' "$DRAFT" | node .claude/skills/deslop/scripts/deslop-scan.mjs -

# files or directories
node .claude/skills/deslop/scripts/deslop-scan.mjs path/to/notes.md
```

Exit code is the finding count, so CI can gate on it. A line containing `deslop-ignore` is skipped.

## Workflow

1. **Scan first.** The mechanical tells are not judgement calls and they are cheap to clear.
2. **Fix by rewriting the clause, never by swapping the character.** `— ` to `, ` produces comma  <!-- deslop-ignore: quoting the banned character -->
   splices and sentences that visibly bend around the gap, and the bending reads as machine-written
   just as loudly as the dash did. A full stop and a new sentence is usually right. A colon is not a
   fix, and readers flag that swap too.
3. **Then read it against [REFERENCE.md](REFERENCE.md).** The tells that matter most are structural
   and no regex sees them: uniform sentence rhythm, the rule of three, sycophancy, a paragraph that
   is fluent and says nothing. A clean scan means the lexical layer is clean, not that the writing
   reads as human.
4. **Re-scan and confirm zero.**

## The trap

The failure mode is trading one default register for another. Stripping the dashes and landing in
the "trying not to sound like AI" voice fools nobody: staccato fragments, forced lowercase, a
"here's the thing" cold open, manufactured casualness, deliberate typos. That register is its own
tell. Aim for the sentence a person would actually type.

Uniformity is the giveaway either way. All-short sentences are as mechanical as all-medium ones, and
a batch of forty comments that all open the same way is uniform in a way no single reader sees but
every maintainer scrolling the queue does.

## What this does not do

It has no house style and it will not write for you. It removes tells and enforces committed rules.
The argument and the voice are yours.

A formal register is not a tell when the piece calls for one. A banned phrase is a banned phrase
because it is committed in the vale style, not because formality is wrong.

## Adding a rule

Edit the vale style under `astro-docs/.vale/styles/Nx/`. The scanner reads those files at runtime, so
`nx vale astro-docs` and this cannot disagree, and a phrase added for docs is enforced on PR comments
the same day. Do not add a phrase list to the script.
