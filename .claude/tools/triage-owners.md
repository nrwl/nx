# Triage owner routing

Who to assign an `nrwl/nx` issue to, and why. Read by `.claude/tools/triage owner <label>`,
which prints a suggested handle on stdout and everything else on stderr for the agent to read.

`CODEOWNERS` in this repo is a single catch-all rule and routes nothing, so this file is the
substitute. It is a living document: edit it when the picture changes.

The upstream source is the **Vertical Ownership** page in Notion,
`https://app.notion.com/p/nxnrwl/Vertical-Ownership-2bd3664b50014710a9ef2f34ee7da3e2`. Read it as the
intent behind this file rather than as current truth, because it lags: as of this writing it still
lists Colum Ferry, who has left and whose areas went to Jason. Where the two disagree, a correction
recorded here from someone on the team wins, and the Notion page should be updated to match.

A suggestion is advisory. Weight is a likelihood, guidance is an instruction, and the issue in
front of you outranks both - override the pick when something names a better owner, and say why.

## Roster

**Only handles listed here may appear in an area table.** `triage owner` fails loudly if a row
names anyone else, so removing someone here is all it takes to get them out of every rotation -
and a stale name can never quietly keep receiving issues. Add a row when someone joins; delete
theirs when they leave.

| Handle             | Name                   | Area                                                          |
| ------------------ | ---------------------- | ------------------------------------------------------------- |
| `FrozenPandaz`     | Jason Jean             | Core CLI, e2e, native, tasks-runner, daemon                   |
| `leosvelperez`     | Leosvel Pérez Espinosa | Core internals, Angular, JS, TS solution setup                |
| `jaysoo`           | Jack Hsu               | Docs and web surface, onboarding, React and framework plugins |
| `AgentEnder`       | Craigory Coppola       | Core, devkit, plugins, dotnet, Windows                        |
| `meeroslav`        | Miroslav Jonaš         | Release. NOT hashing - see note below                         |
| `lourw`            | Louie Weng             | Java: gradle and maven                                        |
| `barbados-clemens` | Caleb Ukle             | Docs                                                          |
| `JamesHenry`       | James Henry            | Release internals, linting                                    |

**The Area column is a description, not routing.** `triage owner` reads the Areas tables further
down and nothing else, so a handle that appears only here can never be suggested by the tool - but it
can still be picked up by a human or an agent reading this table and treating it as an assignment
rule. That has gone wrong: meeroslav was listed as owning "hashing and cache inputs" and was assigned
three PRs on that basis, when he has **zero commits** to `packages/nx/src/hasher`,
`packages/nx/src/native/tasks` or `packages/nx/src/native/cache` in 14 months. His recent work is in
release. Hashing and cache internals are FrozenPandaz (195 commits in `src/hasher`), then AgentEnder
(86) and leosvelperez (73).

Route from an Areas row or from measured history. If you find yourself justifying an assignee with a
phrase from the Area column above, stop and measure instead.

## People

Standing facts that follow someone across every area. A per-area weight overrides the default
here; `weight: 0` keeps someone listed but never auto-suggested.

### JamesHenry

weight: 1

Deepest knowledge of nx release, but his bandwidth is currently spent outside the nx repo. Suggest him only when an issue genuinely needs that depth; otherwise prefer a co-owner.

### jaysoo

weight: 1

**Primarily a docs reviewer now, alongside barbados-clemens.** Director of Engineering rather than an
IC on the CLI team, so his commit counts in packages/react, packages/next and packages/module-federation
are history rather than current capacity. Weight him down everywhere outside docs, and do not route
core daemon, tasks-runner or hashing internals to him at all.

### FrozenPandaz

First or second in nearly every core area, so he is the default fallback almost everywhere. When a row has a legitimate co-owner, use them - it spreads review load and keeps queues moving. Reserve him for areas where he has the only real context, and for continuity: a follow-up or re-review belongs with whoever did the first one.

## Areas

Usually a `scope:` label, but any label that decides routing gets a row - `os: windows` is here
because Windows issues route on who has the hardware rather than who knows the area. A
`defer to scope` candidate is a share of the rotation that hands back to the scope row, so a bias
cannot silently become an override; pass `--scope` alongside it.

### scope: angular

| Handle         | Weight | Note |
| -------------- | ------ | ---- |
| `leosvelperez` |        |      |

### scope: testing tools

Leosvel leads both runners over 14 months - jest 27 v 25 and vitest 21 v 20 - so this is one of the few rows where Jason is the second ask rather than the first.

| Handle         | Weight | Note                              |
| -------------- | ------ | --------------------------------- |
| `leosvelperez` | 3      |                                   |
| `FrozenPandaz` | 2      |                                   |
| `AgentEnder`   | 1      | 12 commits/14mo in packages/jest. |

### scope: linter

ESLint and the boundaries rule are leosvelperez's. Jason has handled oxlint and oxfmt, so route anything in @nx/oxlint (including the boundaries-plugin bridge) to him.

| Handle         | Weight | Note                                                                         |
| -------------- | ------ | ---------------------------------------------------------------------------- |
| `leosvelperez` | 3      |                                                                              |
| `FrozenPandaz` | 2      | Has handled oxlint and oxfmt; prefer him for @nx/oxlint issues specifically. |
| `JamesHenry`   |        |                                                                              |

### scope: js

| Handle         | Weight | Note |
| -------------- | ------ | ---- |
| `leosvelperez` |        |      |
| `FrozenPandaz` |        |      |

### scope: bundlers

Measured on **reviews and merges**, not authorship - authorship reads as near-parity here and is
misleading. Over 14 months Jason merges the majority of every bundler package's PRs (webpack 60/107,
rspack 60/117, vite 64/127) and reviews more than anyone else on all three. Reviews in the last three
months: Jason 25, Craigory 13, Leosvel 10, Jack 9.

Colum Ferry has 88 reviews across these packages and would top a naive git-history fallback. He has
left - last commit 2026-03-24, none since. Do not surface him.

**Vite specifically is Craigory's**, along with vue and nuxt, so send a vite defect to him rather
than taking the row's rotation. The rotation covers webpack and rspack.

When the actual defect is TS solution setup or project references - inferred typecheck vs build
targets, emitted .d.ts, tsconfig references - route to leosvelperez even though the symptom is a
bundler failure.

| Handle         | Weight | Note                                                            |
| -------------- | ------ | --------------------------------------------------------------- |
| `FrozenPandaz` | 3      | Merges over half of all bundler PRs and is the top reviewer.    |
| `AgentEnder`   | 2      | Second most active bundler reviewer over the last three months. |
| `leosvelperez` | 2      | Send TS-solution and project-reference defects here.            |
| `jaysoo`       | 1      |                                                                 |

### scope: module federation

**Jason owns this.** Colum Ferry held it longest and has left, and his areas were reassigned to
Jason rather than redistributed. Do not read Colum's commit history as a live signal, and do not
route MF to Jack on the strength of the React-side split that used to live here.

MF reports frequently turn out to be upstream in module-federation/core rather than ours, so confirm
where the defect actually lives before routing.

| Handle         | Weight | Note                                             |
| -------------- | ------ | ------------------------------------------------ |
| `FrozenPandaz` | 3      | Owns the area, including Colum's former surface. |
| `leosvelperez` | 1      |                                                  |

### scope: storybook

| Handle         | Weight | Note |
| -------------- | ------ | ---- |
| `FrozenPandaz` |        |      |

### scope: react

jaysoo is the top packages/react author (37 commits/14mo), ahead of Jason, so this row should not default to Jason. Send TS-solution/project-reference defects to leosvelperez even when the symptom shows up as a React build failure.

| Handle         | Weight | Note                                                         |
| -------------- | ------ | ------------------------------------------------------------ |
| `jaysoo`       | 3      | Top packages/react author (37 commits/14mo), ahead of Jason. |
| `FrozenPandaz` | 1      |                                                              |
| `leosvelperez` | 1      |                                                              |

### scope: react-native

Covers packages/react-native and packages/expo. Jason leads both (29 / 28) but Leosvel is close behind (19 / 17) and AgentEnder has real expo history (10), so there is a bench here.

| Handle         | Weight | Note                                        |
| -------------- | ------ | ------------------------------------------- |
| `FrozenPandaz` | 2      |                                             |
| `leosvelperez` | 2      | 19 react-native / 17 expo commits per 14mo. |
| `AgentEnder`   | 1      | 10 commits/14mo in packages/expo.           |
| `jaysoo`       | 1      |                                             |

### scope: vue

Craigory owns vue, and vite and nuxt with it. Nuxt has no label of its own, so it arrives here or
under `scope: bundlers`; route it the same way.

| Handle         | Weight | Note |
| -------------- | ------ | ---- |
| `AgentEnder`   | 3      |      |
| `FrozenPandaz` | 1      |      |

### scope: nextjs

Framework issues are FrozenPandaz's. But when the actual defect is TS solution setup / project references - inferred typecheck vs build targets, emitted .d.ts, tsconfig references - route to leosvelperez, who owns that surface, even though the symptom shows up as a framework build failure.

| Handle         | Weight | Note                              |
| -------------- | ------ | --------------------------------- |
| `jaysoo`       | 2      | 24 commits/14mo in packages/next. |
| `FrozenPandaz` | 2      |                                   |
| `leosvelperez` | 1      |                                   |

### scope: remix

| Handle         | Weight | Note |
| -------------- | ------ | ---- |
| `FrozenPandaz` |        |      |

### scope: node

| Handle         | Weight | Note |
| -------------- | ------ | ---- |
| `FrozenPandaz` |        |      |

### scope: release

James has the deepest release knowledge, but Jason and Craigory can both work this area and James is mostly outside the nx repo right now. Default to Jason or Craigory; route to James only when the issue turns on release internals nobody else has context on.

| Handle         | Weight | Note |
| -------------- | ------ | ---- |
| `FrozenPandaz` | 3      |      |
| `AgentEnder`   | 3      |      |
| `JamesHenry`   |        |      |

### scope: core

Near-parity on packages/nx over 14 months - FrozenPandaz 1162 files touched, leosvelperez 1102 - so this is not a one-person row despite feeling like one. Jason leads the narrower subsystems (native 81 v 60, tasks-runner 47 v 33, daemon 24 v 11), so send those to him; package-manager detection, migrate and TS-adjacent core work are Leosvel's.

| Handle         | Weight | Note                                                                       |
| -------------- | ------ | -------------------------------------------------------------------------- |
| `AgentEnder`   | 2      |                                                                            |
| `FrozenPandaz` | 2      | Leads native, tasks-runner, daemon and the TUI.                            |
| `leosvelperez` | 2      | Near-parity on packages/nx; owns package-manager detection and nx migrate. |

### scope: devkit

| Handle       | Weight | Note |
| ------------ | ------ | ---- |
| `AgentEnder` |        |      |

### scope: plugins

| Handle       | Weight | Note |
| ------------ | ------ | ---- |
| `AgentEnder` |        |      |

### scope: repo

| Handle       | Weight | Note |
| ------------ | ------ | ---- |
| `AgentEnder` |        |      |

### scope: dotnet

| Handle       | Weight | Note |
| ------------ | ------ | ---- |
| `AgentEnder` |        |      |

### scope: docs

Caleb and Jack are the two docs reviewers. This is Jack's primary surface now, so weight him here and
down everywhere else.

| Handle             | Weight | Note |
| ------------------ | ------ | ---- |
| `barbados-clemens` | 2      |      |
| `jaysoo`           | 2      |      |

### scope: java

Louie owns this day to day; Jason can also take it.

| Handle         | Weight | Note |
| -------------- | ------ | ---- |
| `lourw`        | 3      |      |
| `FrozenPandaz` |        |      |

### os: windows

Craigory handles roughly 3 in 4 Windows issues because he keeps a Windows desktop, but he is not the only one with access and the area still owns the bug. Consult this row when a record carries os: windows and pass --scope so the remaining share falls back to the scope rotation rather than piling everything on him.

| Handle         | Weight | Note                                                    |
| -------------- | ------ | ------------------------------------------------------- |
| `AgentEnder`   | 3      |                                                         |
| defer to scope | 1      | someone else with Windows access — take the scope owner |

### scope: misc

Cross-cutting by definition, so there is no standing rotation. Derive a candidate from recent commits to the files the fix would touch, and prefer whoever owns the surface the change lands on (packaging and lockfiles, CI, or the plugin in question). Do not reach for a name from memory - the people who historically owned the AI surface and the graph UI have both left, so measure before routing.

_No configured owner - derive one from recent commits._

### scope: nx-cloud

_No configured owner - derive one from recent commits._

### scope: powerpack

_No configured owner - derive one from recent commits._

### scope: self-hosted cache

_No configured owner - derive one from recent commits._

### scope: console

Nx Console lives in nrwl/nx-console. Redirect the reporter rather than assigning anyone here.

_No configured owner - derive one from recent commits._
