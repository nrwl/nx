# Reply templates

These are starting points, not text to paste unchanged. A reply that names the specific missing piece
gets answered; a generic one gets ignored and the issue auto-closes four weeks later having helped
nobody.

## How to write them

- **Attribute derived analysis to triage, not to the maintainer.** These post from a maintainer's
  account. Anything you worked out yourself — a reproduction, a source-level mechanism, a version
  bisect — goes inside a collapsed **Triage notes** `<details>` block, with blank lines around every
  tag or GitHub renders it as raw HTML:

  ```markdown
  <details>
  <summary>

  #### Triage notes — automated triage, reviewed before posting.

  </summary>

  <the evidence>

  </details>

  <the request to the reporter, in plain prose>
  ```

  Keep the actual request outside the block so the human is the one asking. A reply that is purely a
  request (no findings) needs no block at all. Full rationale in the skill's Step 11.

- **Say what you need and why one sentence of it matters.** "We need a repro" is the stale bot's line.
  "The `nx report` shows 21.2.0 but the option you're using landed in 21.4 — which version is the
  failure on?" gets an answer.
- **Show what you already did.** If you ran their steps, say what you ran and what you got. It proves
  the issue was read, and it often surfaces the difference immediately.
- **One request per comment.** A list of five questions gets one answered.
- **Thank them once, at most.** Stacked apologies and exclamation marks read as automated.
- **Don't restate the stale policy.** The bot posts it on its own schedule; duplicating it just makes
  the thread feel like a machine.
- **Never speculate about the cause in a triage comment** unless you have run something. A wrong guess
  from a maintainer sends the reporter off to debug the wrong thing.

## Reproduction needed

> Thanks for the report. To dig into this we need something we can run — a small repo that shows the
> failure, or steps starting from `npx create-nx-workspace` that get there.
>
> [If reproducible on https://github.com/nrwl/nx-examples, that repo works too.]
>
> Right now the part we can't reconstruct is `<the specific gap: the project configuration, the
executor options, how the libraries are wired>`.

## More information needed

> Thanks for the report. Could you add the output of `nx report`? Without it we can't tell which
> version of `<package>` this is on, and the behavior you're describing changed in `<version>`.

## Ran it, didn't reproduce

> I ran this against `<version>` in a fresh workspace:
>
> ```
> <exact commands>
> ```
>
> and got `<what happened>` rather than `<reported symptom>`. So something differs between our
> setups — `<package manager / node version / OS>` would be the first place I'd look. Could you check
> whether your repro still fails on a clean clone?

## Looks fixed on a newer version

> This reproduces on `<reported version>` but not on `<current version>` — `<commit or PR, if you
found it>` looks like the fix. Could you try upgrading and let us know? Happy to reopen if it's
> still there.

## Duplicate

> This looks like the same problem as #`<N>`, which has `<a reproduction / an open PR / more
discussion>`. Closing in favor of that one so the discussion stays in one place — please follow
> along there, and say so if you think these are actually different.

## Feature request

> Feature requests are tracked in Discussions rather than issues, so we can gauge interest before
> committing to a design: https://github.com/nrwl/nx/discussions/new?category=feature-requests
>
> Would you mind reposting there? `<one line on what's interesting about the idea, if there is one>`

## Belongs to Nx Console

> This is the Nx Console extension rather than the Nx CLI — it's developed at
> https://github.com/nrwl/nx-console and issues filed there reach the people who work on it.

## Upstream bug

> Traced this to `<dependency>` rather than Nx: `<the evidence>`. Tracking upstream at `<link>`.
> Leaving this open so people can find it, but the fix has to land there first.
