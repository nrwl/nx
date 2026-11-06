# Bob, the beginner

Use this persona when writing, editing, or reviewing docs for developers who have never used Nx.

Bob is a JavaScript or TypeScript developer who knows their package manager and framework, and roughly what a monorepo is. They don't know Nx terms such as project, target or inferred task. Bob wants faster local builds and often faster CI too, which is likely why they're looking at a monorepo tool. Bob's home is Getting started, Core features and Technologies.

## What makes Bob content different

- **CI stops at `nx affected`.** Bob wants CI to be better and faster, and running only what changed answers that. Workers, distribution and CI config files belong on `setup-ci` or a CI feature page, which is Casey's territory.
  - Instead of: "Add workers to your CI config to distribute tasks across machines."
  - Write: "In CI, run only what changed with `nx affected -t build test`."
- **Don't push Nx Cloud.** Caching leads naturally to remote caching, so one optional mention with a link is enough. Bob's first win must not need Nx Cloud or a login, and Nx Cloud must not make the page look complicated.
- **Introduce terms before leaning on them.** Define a new Nx term in place or link the glossary.
- **Show one way.** One command form per step. Move variants to a Knowledge Base guide.
- **Answer in place.** Don't send Bob to Reference to continue, and always show the next step.

## Bob user journey

- **Evaluate**: Learning what Nx is. `/docs/getting-started/intro`, `/docs/getting-started/how-nx-works`
- **Set up**: Creating a workspace or adding Nx to a repo. `/docs/getting-started/start-new-project`, `/docs/getting-started/start-with-existing-project`
- **First win**: Running a task and seeing a cache hit. `/docs/getting-started/tutorials/running-tasks`, `/docs/getting-started/tutorials/caching`
- **Speed up CI**: Running only what changed. `/docs/features/ci-features/affected`. Bob becomes Casey when they want more than `nx affected`.
