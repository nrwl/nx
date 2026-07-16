---
name: draft-security-advisory
description: Draft a GitHub security advisory (GHSA) for nrwl/nx from a vulnerability report. Investigates the affected code, determines affected packages and version ranges, proposes a CVSS score and CWEs, and writes a draft advisory following the layout of previously published nrwl/nx advisories. Output is a local draft only — a human reviews and publishes. Use when a security vulnerability report needs to become an advisory, or when the user says "draft an advisory", "write a GHSA", or "security advisory for <report>".
allowed-tools: Bash(gh api *), Bash(gh pr view *), Bash(gh pr list *), Bash(gh issue view *), Bash(gh search *), Bash(gh release view *), Bash(gh release list *), Bash(git -C *), Bash(git log *), Bash(git tag *), Bash(git show *), Bash(git branch *), Bash(npm view *), Bash(ls *), Bash(cat *), Bash(head *), Bash(tail *), Bash(jq *), Bash(grep *), Bash(mkdir -p *), Write(tmp/security-advisories/**), Edit(tmp/security-advisories/**), Read, Grep, Glob, Agent
argument-hint: "<report file path, pasted report text, or pointer to the report>"
---

# Draft Security Advisory (draft-security-advisory)

Turn a vulnerability report into a ready-to-review GitHub security advisory draft
for `nrwl/nx`. This skill drafts; it NEVER publishes. The final review and the
publish step are always performed by a human.

Save the finished draft to `tmp/security-advisories/<slug>/advisory.md` (gitignored),
where `<slug>` is a short kebab-case name for the vulnerability
(e.g. `graph-server-cors`).

## Inputs

The argument is the vulnerability report: a file path, pasted text, or a pointer
(e.g. a GitHub private vulnerability report / GHSA draft ID, fetchable via
`gh api /repos/nrwl/nx/security-advisories/<GHSA-ID>`). If no report is provided,
ask for one — do not invent a vulnerability.

## Process

Work through these phases in order. Do not skip the investigation phases — the
advisory must be grounded in the actual code, not just the reporter's claims.

### Phase 1 — Understand the report

- Read the full report. Identify: the claimed flaw, the attack scenario, the
  entry point (which package / command / server), and any proof of concept.
- Restate the vulnerability in one sentence before proceeding. If the report is
  ambiguous or you cannot confirm the flaw exists in the code, stop and report
  that instead of drafting.

### Phase 2 — Confirm scope in the code

- Locate the vulnerable code in this repo. Read enough surrounding code to
  understand the real trust boundary: what is attacker-controlled, what checks
  exist, and what the worst-case outcome is.
- Determine what is and is not exposed. Which configurations, commands, or
  product surfaces trigger the vulnerable path? Which ones use a different code
  path and are unaffected? This is a per-report judgment based on the code you
  just read — verify each claim of "not affected" by finding the diverging code
  path, and say so in the draft with a `> [!IMPORTANT]` callout.
- Distinguish "practical impact in realistic usage" from "theoretical worst
  case" — the Summary states the practical impact; the Details section may note
  the escalation path.

### Phase 3 — Establish version ranges

- Find the commit/PR that introduced the flaw: `git log -S '<code fragment>'`
  or `git log --follow` on the file, then `gh pr list --search <sha>` to map
  the commit to a PR.
- Map the introducing commit to the first released version:
  `git tag --contains <sha> | sort -V | head`.
- Find the fix PR(s) and the first patched version(s) on every affected release
  line (including backports). Verify with `npm view <pkg> versions --json` that
  the patched versions are actually published.
- List every affected npm package separately with its own vulnerable range and
  patched versions. If a package is deprecated rather than patched, its
  remediation is migration guidance, not an upgrade.

### Phase 4 — Score severity

- Propose a CVSS vector and score (v3.1 or v4.0 — match whichever the fix team
  is using; include the full vector string). Justify each metric choice in one
  line each in your working notes; the advisory itself gets the score, the
  vector, and a one-sentence statement of exploitation preconditions.
- Identify the applicable CWE ID(s).

### Phase 5 — Write the draft

Write `tmp/security-advisories/<slug>/advisory.md` with two parts:

1. The advisory body (markdown, layout below) — this is what gets pasted into
   the GHSA "Description" field.
2. A metadata section at the end for the GHSA form fields: summary/title
   (≤ 100 chars), severity, CVSS vector, CWE IDs, and a per-package table of
   `ecosystem | package | vulnerable version range | patched versions`.

Then print the draft location and a short recap (severity, affected packages,
patched versions) so the reviewer can sanity-check at a glance.

## Advisory body layout

Follow the structure of previously published nrwl/nx advisories
(e.g. GHSA-vp3h-ghgh-jr7g, GHSA-g2r8-wvmj-jf5w). Sections, in order:

```markdown
## Summary

One short paragraph: what the flaw is, who is exposed, and the practical
impact. If the realistic impact differs from the theoretical worst case,
state the realistic one here.

## Severity

**<High/Medium/...>** — CVSS vX.Y **<score>** (`<full vector string>`)

One or two sentences on exploitation preconditions (what an attacker needs,
what the victim must be doing).

- **CWE-NNN**: <name>

## Affected & Patched Versions

Per-package version ranges and patched versions. State which version
introduced the flaw. Call out release lines that are NOT patched and where
those users should go.

> [!IMPORTANT]
> Use callouts like this to scope the blast radius when the investigation
> shows that common configurations or related surfaces are unaffected —
> name them explicitly and say why they are unaffected.

## Remediation

Exact upgrade targets ("Upgrade to `X.Y.Z` or later"). Note when the fix is a
drop-in vs. requires configuration changes. For deprecated packages, link the
migration guidance instead of a patched version.

## Details

Technical walkthrough: the vulnerable code (short, real snippets from the
repo), why it is exploitable, and what the fix changes. Be precise about what
is attacker-controlled and what is not — if part of the attack requires
capabilities that already imply code execution, say so.

## References

- Fix: <PR link(s)>
- Introduced: <PR link(s) that introduced the vulnerable code>
- Any related advisories, CVEs, or docs

## Credits

- **<Name>** (<affiliation or GitHub handle>) — Reporter
```

## Hard rules

- Never publish, create, or update an advisory on GitHub. Output is the local
  draft file only. If the reviewer wants to create the GHSA draft via
  `gh api`, they run that themselves after review.
- Never include unpublished vulnerability details in anything that leaves the
  draft directory (commits, PRs, issues, comments).
- Every factual claim in the draft (ranges, introducing PR, patched versions,
  "not affected" statements) must be verified during Phases 2–3, not copied
  from the report.
- Credit the reporter by the name/handle they used in the report.
