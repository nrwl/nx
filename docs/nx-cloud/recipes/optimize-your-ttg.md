# Optimize Your Time to Green (TTG)

Time to Green (TTG) is the **time from when a pull request (PR) opens and triggers CI to the moment all checks are green and the PR is review-ready**.

TTG is a practical sub-metric of Time to Merge (TTM): by compressing TTG (lower is better), you remove the biggest day‑to‑day bottlenecks that developers feel, which in turn improves overall TTM.

## Why is this important?

<!-- {% ci-bottleneck /%} -->

The biggest day‑to‑day waste in engineering teams: **constant context switching and PR babysitting**. The common loop is:

- 🧑‍💻 Write code
- 🧑‍💻 Push PR
- ⏳ CI runs
- ❌ CI fails 2 minutes later
- ⏳ Discover it much later
- ‍🧑‍💻 Switch context to debug and trigger CI run
- ⏳ Re-running CI
- ❌ Flaky test fails CI
- ‍🧑‍💻 Switch context to debug and trigger CI run
- ⏳ Re-running CI
- ✅ CI is finally green
- ‍🧑‍💻 Reach out to someone to review

This delay compounds across teams and drastically slows delivery. **Nx Cloud fixes this.**

## How to improve TTG

High TTG usually comes from three sources: slow failure discovery, disruptive PR babysitting, and raw execution time. Tackle them in this order.

**Prerequisite: Connect your workspace to Nx Cloud**

If you haven't already, run the following command to connect your workspace to Nx Cloud:

```shell
npx nx@latest connect
```

### 1) Get failure feedback immediately (avoid late discovery)

When you don't notice CI failed, you lose time before you can act. Tighten the loop so failures surface where you’re working.

**What to do:** See failures immediately where you work by getting a notification in your editor: install [Nx Console](/getting-started/editor-setup).

### 2) Eliminate PR babysitting (minimize context switching)

The expensive loop is switching branches to fix, re‑pushing, waiting, and repeating; especially with flakes.

**What to do:**

- Approve fixes instead of branch‑hopping: enable **[Self‑Healing CI](/ci/features/self-healing-ci#configure-your-ci-pipeline)** to analyze failed tasks, propose and verify fixes, and commit to your PR after approval.
- Also enable **[flaky task detection and retries](/ci/features/flaky-tasks)** to automatically re-run flaky tasks in the background while you keep working undisturbed.

### 3) Shorten actual CI time (make the pipeline fast)

Once feedback and context switching are handled, compress the compute side.

**What to do:**

- Reuse work with **[Remote caching (Nx Replay)](/ci/features/remote-cache)**.
- Run more in parallel with **[Distributed task execution (Nx Agents)](/ci/features/distribute-task-execution)**.
- Scale long suites with **[E2E test splitting](/ci/features/split-e2e-tasks)** so they finish quickly.

## Measure TTG and diagnose bottlenecks

![TTG metrics](/nx-cloud/recipes/nx-cloud-ttg-stats.avif)

**Doing too much work on PRs**

- Use [Nx Affected](/ci/features/affected) to only run what changed.

**Cache hit rate is low**

- Ensure tasks are cacheable and deterministic. Define `outputs` and configure `inputs`/`namedInputs` correctly. See: [Configure Inputs](/recipes/running-tasks/configure-inputs), [Configure Outputs](/recipes/running-tasks/configure-outputs), [Inputs Reference](/reference/inputs)
- Standardize Node/PNPM versions across dev and CI; avoid environment variables that unintentionally affect inputs.
- Use [Remote caching (Nx Replay)](/ci/features/remote-cache) to share results between CI and dev machines.

**Agents are idle, or queue time is high**

- Increase or right-size distributed capacity and parallelism with [Nx Agents](/ci/features/distribute-task-execution).
- Use [Dynamic Agents](/ci/features/dynamic-agents) to scale based on PR size.
- Remove unnecessary serialization (global locks, [overly strict `dependsOn`](/recipes/running-tasks/defining-task-pipeline)).

**E2E suites take too long**

- Enable [E2E test splitting](/ci/features/split-e2e-tasks) so large suites run across agents.
- Ensure tests are shardable (no hidden global state, independent specs).

**Flaky task rate is high**

- Enable [Flaky task detection and automatic retries](/ci/features/flaky-tasks).
- Isolate and quarantine persistently flaky suites to keep pipelines green.

**Late failure discovery / PR babysitting**

- Install [Nx Console](/getting-started/editor-setup) for instant failure and fix notifications in your editor.
- Enable [Self‑Healing CI](/ci/features/self-healing-ci) to propose and validate fixes automatically (ensure the `npx nx-cloud fix-ci` step runs with `if: always()`).

## Talk to us

If you still need help feel free to [reach out to us](/contact).
