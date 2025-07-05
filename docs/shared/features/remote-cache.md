---
title: 'Remote Caching (Nx Replay)'
description: 'Learn how to use Nx Replay to share computation caches across your team and CI, speeding up builds and saving CI costs.'
---

# Use Remote Caching (Nx Replay)

{% youtube
src="https://youtu.be/NF1__N_snog"
title="Remote Caching with Nx Replay"
 /%}

Repeatedly rebuilding and retesting the same code is costly — not just in terms of wasted resources, but also in terms of developer time. To solve this, Nx includes a sophisticated computation caching system that ensures **code is never rebuilt twice**, saving you both time and resources.

![Diagram showing Teika sharing his cache with CI, Kimiko and James](/shared/images/dte/distributed-caching.svg)

By default, Nx [caches task computations locally](/features/cache-task-results), but the biggest benefit comes from **sharing this cache across your team and in CI**.

- **Zero config** and **secure** by default
- Drastically **speeds up task execution times** during local development, and more critically in CI
- **Saves money on CI/CD costs** by reducing the number of tasks that need to be executed (we observed 30-70% faster CI & half the cost)

Nx **restores terminal output, along with the files and artifacts** created from running the task (e.g., your build or dist directory). If you want to learn more about the conceptual model behind Nx's caching, read [How Caching Works](/concepts/how-caching-works).

## Configure Remote Caching

To use **Nx Replay**, you need to connect your workspace to Nx Cloud (if you haven't already).

```shell
npx nx connect
```

See the [connect to Nx Cloud recipe](/ci/intro/connect-to-nx-cloud) for all the details.

## Why use Remote Caching (Nx Replay)?

Nx Replay directly benefits your organization by:

- **Speeding up CI pipelines:** With Nx Replay, tasks that have already been executed in a PR's initial CI pipeline run can **reuse cached results in subsequent runs**. This reduces the need to re-run unaffected tasks, significantly speeding up the CI process for modified PRs. This benefit complements the [affected command](/ci/features/affected), which optimizes pipelines by only running tasks for projects that could be impacted by code changes.

- **Boosting local developer efficiency:** Depending on [how cache permissions](/ci/recipes/security/access-tokens) are set for your workspace, developers can reuse cached results from CI on their local machines. As a result, tasks like builds and tests can complete instantly if they were already executed in CI. This accelerates developer workflows without any extra steps required.

- **Enabling Nx Agents:** Nx Replay is crucial for [Nx Agents](/ci/features/distribute-task-execution) to function efficiently. Nx Agents leverage remote caching as a **transport mechanism** for transferring task artifacts between machines as it distributes tasks. When a task depends on another task that may have been executed on a different agent, Nx Replay ensures the necessary artifacts are transferred seamlessly. This allows each agent to execute only its assigned tasks while relying on cached results for dependencies, ensuring tasks run only once and are shared across all agents. [Learn more about Nx Agents](/ci/features/distribute-task-execution).

## What gets stored?

Nx Cloud stores the following:

- **Terminal output:** The terminal output generated when running a task. This includes logs, warnings, and errors.
- **Task artifacts:** The output files of a task defined in the [`outputs` property of your project configuration](/recipes/running-tasks/configure-outputs). For example, the build output, test results, or linting reports.
- **Hash:** The hash of the inputs to the computation. The inputs include the source code, runtime values, and command line arguments. Note that the hash is included in the cache, but the actual inputs are not.

Learn more about [how caching works](/concepts/how-caching-works#what-is-cached).

## Security in Remote Caching

Since we work with many large corporations (including banks, insurance companies, and governments), we take security very seriously. Nx Cloud provides several features to ensure your data remains safe and secure:

- **Immutability:** Each cache entry is immutable, meaning once an entry is created, it cannot be altered. This ensures that cached results cannot be tampered with by malicious parties, preventing the injection of vulnerabilities into your build process.

- **Access Control via Tokens:** Nx Cloud allows you to [control who can read from and write to the cache](/ci/recipes/security/access-tokens). For example, you can configure these settings to restrict cache write access to your CI pipeline while allowing all developers to only read.

- **End-to-End Encryption:** Nx Cloud supports end-to-end encryption to protect your data. Task artifacts are encrypted before being sent to the remote cache and decrypted when retrieved. This ensures that even if someone gains access to Nx Cloud servers, they cannot view your stored artifacts. For more details, visit the [encryption documentation](/ci/recipes/security/encryption).

- **Nx Enterprise (Self-Hosting and EU Regions):** For organizations with specific compliance or data residency requirements, Nx Enterprise offers the option to self-host Nx Cloud on your own infrastructure. Additionally, you can choose to host in EU regions, ensuring that your data complies with regional data protection laws. This is available to our [Nx Enterprise customers](/enterprise).

- **SOC Certification:** Nx and Nx Cloud are SOC Type 1 and Type 2 certified, providing an additional layer of assurance that your data is handled according to industry-standard security practices. For more details, you can visit our [security page](https://security.nx.app).

### Configure Caching Access

Caching access can be restricted in terms of read/write access. You can configure this in your [Nx Cloud dashboard](https://nx.app). Learn more about it [here](/ci/recipes/security/access-tokens).

## FAQ

### What if the remote cache is offline?

Nx Replay automatically syncs the remote cache to the local cache folder. As such, if the remote cache is not available, it will automatically fall back to the local cache or just run the task if it is not cached.

### Can I self-host my remote cache?

If you're an enterprise and have special restrictions, [reach out to us](/enterprise/trial). Our enterprise plan includes various hosting options, from dedicated EU region hosting, to single-tenant and also on-premise.

### How can I skip Nx Cloud caching?

To learn more about how to temporarily skip task caching, head over to [our corresponding docs page](/recipes/running-tasks/skipping-cache#skip-remote-caching-from-nx-cloud).
