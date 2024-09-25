---
title: Introducing Explain with AI
slug: 'explain-with-ai'
authors: ['Philip Fulcher']
cover_image: '/blog/images/2024-07-29/explain-with-ai-header.avif'
tags: [nx, nx-cloud, ai, release]
youtubeUrl: https://youtu.be/g2m9cHp-O-Q?si=ax-SKCO0Xvy9vFIz
pinned: true
---

It's Friday, and you absolutely, positively have to deploy to production. But you can't get CI to pass your PR. What do you do? It's an inevitable part of your life as a developer, and you've built a collection of tools to deal with it: Google, MDN, Discord, ChatGPT. We've got one more tool for your toolbox: **"Explain with AI" for [Nx Cloud](/nx-cloud)**.

## Your ticket to fast error debugging

"[Explain with AI](/ci/features/explain-with-ai)" is a new feature for all Nx Cloud Pro users that is going to help you troubleshoot those pesky failing tasks. Whenever you get an error message on CI, look for the "Explain with AI" button on the upper right-hand corner:

![Explain with AI button](/blog/images/2024-07-29/explain-with-ai-button.avif)

Once you hit that button, we collect the terminal output and other Nx task information and sprinkle some AI on top of it to give you a suggested fix. That should help you quickly get to the bottom of the issue and get back to work quickly.

![Explain with AI explaining how to resolve the CI error](/blog/images/2024-07-29/explain-with-ai-2.avif)

No more switching back and forth between a dozen tabs with different solutions. No more providing the right context for your masterfully written chat prompt. **Get your suggested fix and get back to work.**

Also make sure [to check out our docs](/ci/features/explain-with-ai) for more information.

## How can I start using this today?

![Nx Cloud organization settings section for enabling AI features](/blog/images/2024-07-29/ai-features.avif)

Here's how you get started:

- **Step 1:** Go to your [Nx Cloud](https://cloud.nx.app/) organization settings
- **Step 2:** Enable AI features
- **Step 3:** Accept the Nx Cloud AI terms and conditions.
- **Step 4:** You're all set ✨

Note that you'll need to be an organization admin for your Nx Cloud workspace to enable AI features.

{% call-to-action title="Log in to Nx Cloud" url="https://cloud.nx.app" icon="nxcloud" description="Enable AI features in your organization settings" %}
Log in to Nx Cloud
{% /call-to-action %}

### I want to try this, but I'm on the Hobby plan 🤔

If you're currently on the Hobby plan, you can start a free Pro plan trial for 14 days to try it out on your own workspace. No, we don't ask for credit cards to start a trial, so feel free to experiment!

## More to come!

This is just the first of a series of AI-powered features that we're going to be rolling out to your workspaces. We've got some cool features in the works already, which we're going to **announce publicly during the [Monorepo World](https://monorepo.world) conference in October**! So stay tuned!

## Learn more

- [Nx Docs](/getting-started/intro)
- [X/Twitter](https://twitter.com/nxdevtools) -- [LinkedIn](https://www.linkedin.com/company/nrwl/)
- [Nx GitHub](https://github.com/nrwl/nx)
- [Nx Official Discord Server](https://go.nx.dev/community)
- [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
- [Speed up your CI](/nx-cloud)
