---
title: 'Custom Task Runners and Self-Hosted Caching Changes'
slug: custom-runners-and-self-hosted-caching
authors: [Victor Savkin]
description: 'Learn about free plugins for self-hosting your cache, a new Open API RFC and hooks for the task lifecycle as well as the commitment to open source and improved community collaboration.'
tags: [nx]
cover_image: /blog/images/articles/bg-self-hosted-caching-article.jpg
---

**TL;DR:** **Nx remains free for everyone who chooses to self-host their own cache**. There will be two ways to self-host:

1. **Maximum independence and control:** An OpenAPI specification so you can run your own cache server implementation on your own terms.
2. **Maximum convenience:** Free plugins for each major cloud storage provider (and arbitrary file system storage), all maintained by us.

These options will be released before Nx 21.

---

**So, what happened?**

In September 2024, we announced that custom task runners would be deprecated and would reach end-of-life in April 2025. This announcement is consistent with how we typically design and ship. We create a draft proposal (for example, a new API) that doesn't affect anyone immediately and give ourselves 6 to 12 months to gather feedback from the community, with real teams. After which, once it becomes stable, we finalize the design. I strongly believe in designing-while-doing and we've found that continuous-thinking-without-doing re-enforces ivory tower solutions.

In this instance, we did not spend enough time engaging with the community on a couple key concerns. Our communication around this situation also fell short and I sincerely apologize for the confusion and concern this caused. I will outline the feedback we heard below and explain what we're improving to ensure this does not happen again.

## **1. "We don't want open source capabilities to be taken away."**

While we're still deprecating the older custom task runners API, our mistake was in not providing one-for-one replacement. To address this, we are introducing new APIs to replace the old one — **fully supporting everything the previous implementation offered, including free self-hosted caching.**

### Self-Hosted Cache API RFC

We have [published a new RFC](https://github.com/nrwl/nx/discussions/30548) detailing a custom self-hosted cache based on an OpenAPI specification. This will be available before Nx 21, ensuring a smooth migration path for those who are looking for full control.

### New preTasksExecution and postTasksExecution API

Some teams used custom task runners for non-cache-related workflows, and removing them created gaps in functionality. We have released open-source preTasksExecution and postTasksExecution hooks to provide the same capabilities in a more composable way. More details [in our docs](/extending-nx/recipes/task-running-lifecycle). We also [added detailed instructions to migrate to this new API](/deprecated/custom-tasks-runner#the-pretasksexecution-and-posttasksexecution-hooks) if you've been using custom task runners for such use cases in the past.

We worked closely with large teams that have advanced use cases to ensure they can still accomplish everything they did before.

{% callout title="A Clear Commitment Moving Forward" type="info" %}

Our commitment is that **no major open-source feature or API will be replaced with a non-open-source alternative.** Some features will inevitably become obsolete over time, but when that happens, we will provide clear deprecation notices and migration strategies. Nx will continue to evolve, but removing an old API will never be a means to move users toward a paid feature.

We will keep developing Nx Cloud and other premium offerings for teams that need enterprise-scale solutions, but we remain focused on a strong open-source foundation that allows teams to use and scale Nx without requiring paid features.

Nx open-source remains a primary focus for us as a company.

{% /callout %}

### **@nx/s3, @nx/gcp, @nx/azure… and related packages are free for everyone**

In addition to updating the API, we believe the first-party packages we offer are the best option for most organizations using self-hosted cache today – **so we've made them free for everyone**. The activation is simple and can be done in the CLI. _Full refunds will be issued to anyone who paid for these packages during this transition._

> **Why is there an activation process?** It simply helps us better understand our users as we continue to improve our tools. You can also use the OpenAPI specification to run your own cache – for complete independence.

## 2. "We want more input into the roadmap."

We recognize that some of these changes felt abrupt. To address that, we've put the following measures in place to improve how we involve the community in major decisions:

- **New RFC Process:** We've started putting all major API changes through an RFC process before being finalized:
  - [**RFC: Nx Custom Self-Hosted Remote Cache**](https://github.com/nrwl/nx/discussions/30548)
  - [**RFC: Linking Packages with Workspaces**](https://github.com/nrwl/nx/discussions/29099) (new [TypeScript Setup](/blog/new-nx-experience-for-typescript-monorepos))
  - [**RFC: Infinite Tasks**](https://github.com/nrwl/nx/discussions/29025)
- **Regular Office Hours:** A space for open discussions, where we share updates and answer questions. Join us [here](http://go.nx.dev/office-hours)!
- **Published Roadmaps:** More transparency on what's coming next. View [current roadmap](https://github.com/nrwl/nx/discussions/28731).
- **Closer Collaboration with Nx Champions and teams:** This new approach – and even this post – were shaped through dozens of conversations with [**Nx Champions**](/community) and many teams. We will continue to do so to minimize future blindspots.

### **Moving Forward**

The community's enthusiasm is what makes Nx successful, and we're very grateful for it. Good developer tools aren't built in isolation; they come from working together, listening, and refining as we go. The conversations we had over the past few months have helped us shape a better solution – one that works for more teams while keeping Nx fast and powerful.

A huge thank you to everyone who shared their thoughts and helped push Nx forward - we wouldn't be where we are without you!

- Victor Savkin and the Nx Team
