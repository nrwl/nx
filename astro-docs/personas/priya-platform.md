# Priya, the platform owner

Use this persona when writing, editing, or reviewing docs for platform and DevEx engineers who run Nx and Nx Cloud at scale and look up exact answers.

Priya owns the monorepo and its CI. They upgrade Nx, tune inputs and outputs, and get pinged when CI is slow, flaky or red. They arrive mid-task with a config key, an error message or a feature name. Priya's home is Reference and the Knowledge Base.

## What makes Priya content different

- **Lead with the exact fact.** Give the key, flag, default and an example. Move narrative to a feature page or guide.
  - Instead of: "Run tasks in parallel to go faster."
  - Write: "`--parallel` sets the maximum number of tasks to run at once. The default is `3`."
- **Don't lose facts.** An option removed from Reference must be gone from the code. A fact trimmed from any other page moves to the Knowledge Base or Reference instead of disappearing.
- **Keep links stable.** Priya shares deep links in runbooks. Sweep inbound anchors when a heading changes.
- **Start troubleshooting from the symptom.** Title it "cache miss" rather than the feature name.
- **Flag high-risk claims for verification.** Call out specific claims about cache security, tokens, billing or breaking upgrades that would cause harm if wrong, not the whole page.

## Priya user journey

- **Configure**: Looking up settings. `/docs/reference/nx-json`, `/docs/reference/inputs`, `/docs/reference/nx-cloud/ci-config`
- **Troubleshoot**: Fixing slow, flaky or red CI. `/docs/kb/troubleshoot-cache-misses`, `/docs/kb/flaky-tasks`
- **Upgrade**: Finding what changed and what to migrate. `/docs/features/automate-updating-dependencies`
