---
title: 'Upgrade your Lerna Workspace — Make it Fast and Modern!'
slug: 'upgrade-your-lerna-workspace-make-it-fast-and-modern'
authors: ['Juri Strumpflohner']
cover_image: '/blog/images/2022-10-28/1*t3i1a7CL500_YOicB2Erag.png'
tags: [nx]
---

Currently experiencing a slow Lerna workspace? Feels old and you’re looking for alternatives? Keep on reading, because all it might need to get a fast and modern experience is to upgrade your Lerna package.

[Lerna](https://lerna.js.org/) has come a long way:

- created 6 years ago to solve the specific problem of managing the [Babel repo packages](https://github.com/babel/babel)
- then became the de-facto tool for managing & publishing packages in JS-based monorepos
- got declared “not actively maintained” in March 2022
- got revived again in May 2022 by [passing on stewardship to the Nx team](/blog/lerna-is-dead-long-live-lerna).

Since May 2022, a lot has changed! **Lerna became fast & modern**, getting features you’d expect from a 2022 monorepo management tool. Version 6 just got out a couple of weeks ago. If you missed that, check out my blog post [“Lerna Reborn — What’s new in v6”](/blog/lerna-reborn-whats-new-in-v6), which goes into the details of all the cool features that were part of that release.

**Prefer a video version of this post instead?** I got you covered:

{% youtube src="https://www.youtube.com/watch?v=MwGPMvhJS0A" /%}

## Still using “old Lerna”? Upgrade!

Upgrading your Lerna workspace should be **as easy as installing the latest** `**lerna**` **npm package**.

The team increased the major version to be cautious and to communicate the chance for potential breaking changes clearly. Most workspaces won’t experience them, though.

## Configure Caching & Task Pipeline

To get the most out of your Lerna workspace, [enable caching](https://lerna.js.org/docs/features/cache-tasks). Caching can be enabled by creating a `nx.json` and defining the cacheable operations. In addition to that, you can also specify which tasks need to be run in topological order (e.g. due to dependencies between build tasks).

The easiest way to set this up in a mostly automated fashion is to run the following command:

```shell
npx lerna add-caching
```

This generates a new `nx.json`, which can be fine-tuned further.

## Fine-tune Cache Inputs

When it comes to caching, you can even get a step further. On each run, the caching mechanism computes a hash out of all the project’s files and uses that hash to query the cache for an existing run.

You might want to fine-tune that, though. Example: you don’t want to invalidate your `test` task's cache just because we updated a package's `README.md`. To avoid that, you can define `inputs` for your operations:

This simple configuration first, by default, includes all project files, but in a 2nd glob pattern, excludes Markdown files in particular (notice the `!` in front).

You can optimize these expressions and even reuse them across different targets. But for more details, [consult the Lerna docs](https://lerna.js.org/docs/concepts/how-caching-works#source-code-hash-inputs).

## Add Remote Caching

The real benefit of caching is when you distribute and share it with co-workers and your CI. Leveraging previously cached runs (especially on CI) results in huge time savings.

Since Lerna uses Nx as a task runner, the remote cache setup is based on [Nx Cloud](/nx-cloud).

Running the following command sets up your workspace:

```shell
npx nx connect-to-nx-cloud
```

More [on the Lerna docs](https://lerna.js.org/docs/features/cache-tasks#distributed-computation-caching)

## Learn more

- 🧠 [Lerna Docs](https://lerna.js.org/)
- 👩‍💻 [Lerna GitHub](https://github.com/lerna/lerna)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nrwl Youtube Channel](https://www.youtube.com/nrwl_io)
