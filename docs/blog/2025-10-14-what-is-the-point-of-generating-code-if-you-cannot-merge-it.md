---
title: "What's the Point of Generating All This Code If You Can't Merge It?"
slug: 'pr-review-is-the-bottleneck'
authors: ['Victor Savkin']
tags: [nx, nx-cloud, self-healing, ai]
cover_image: /blog/images/articles/self-healing-pr-bottleneck-hero-img.avif
description: "AI speeds up code authoring, but PR validation becomes the bottleneck. Learn how Nx's Self-Healing CI automatically fixes broken PRs to keep teams moving."
pinned: true
---

Software engineering involves many activities, but developers spend most of their time on two: **authoring code** and **validating code**.

![Typical software developer process](/blog/images/articles/engineers-ai-process_white.avif)

The AI revolution has focused almost entirely on code generation, on the authoring. LLMs excel at this. But these benefits evaporate if the validation phase can't keep up.

**Now the focus has expanded to include the validation phase, and several AI tools have emerged to address this.** **Nx is one of them**. Its agentic Self-Healing CI, among other capabilities, drastically reduces the time required to validate changes in CI.

## **Authoring and Validating**

**Development Lead Time** is the time from idea to merged code. It breaks down simply:

```plaintext
Development Lead Time = Authoring Time + Validation Time
```

Validation Time consists of:

- **Time-to-Green**: CI must pass
- **Time-to-Approval**: A code reviewer must approve

Average validation time varies wildly between teams and projects, often exceeding multiple days or even weeks. Why so long? Complex projects have slow, unstable CI that requires multiple reruns. PRs contain mistakes that need investigation and fixes. Each iteration is costly.

Meanwhile, getting senior engineer feedback takes time. Addressing that feedback requires more iterations, triggering all those CI issues again.

Anyone working on serious projects knows: **landing a PR often takes more effort than authoring it**. Developers bundle unrelated changes to reduce iterations. They ask to "address feedback in a follow-up" because getting to green was painful.

For this post, let's assume: **16 hours to author, 8 hours to validate = 24 hour lead time**.

![Time distribution: slow authoring and validation](/blog/images/articles/time-distr-slow-authoring-validation.avif)

## **AI is Making Authoring Cheaper**

Credible studies (e.g., [here](https://www.youtube.com/watch?v=tbDDYKRFjhk)) show AI accelerates PR authoring by 15-20% in real organizations, with expectations this will increase. Let's assume our imaginary team will be able to reduce average authoring time from 16 hours to 8\. Great, more PRs are being created in less time.

Does it mean our development lead time is now 16 hours (8 to author and 8 to validate)?

![Time distribution: authoring and validation](/blog/images/articles/time-distr-authoring-validation.avif)

**No. It doesn't.** It assumes validation is elastic - that the PR volume increase doesn't slow down validation. **_It does slow validation_** ([see here](https://www.faros.ai/blog/ai-software-engineering)).

Code reviews become bottlenecked by senior engineers with limited time and even more PRs to review. CI runs need VM pools. PRs queue for merges. **If you do nothing, more PRs means slower validation.**

![Time distribution: slow authoring with validation](/blog/images/articles/time-distr-authoring-slow-validation.avif)

Fixed capacity creates an M/M/1 queue situation:

![M/M/1 queue situation diagram](/blog/images/articles/chart-m_m_1_queue.avif)

Even if you're faster to author your PRs, you're still being slowed down by the validation bottleneck. And the more PRs, the bigger the pressure, the more it'll slow down the pipeline. Everyone experiences this when an infra failure or broken main branch halts team progress.

Real systems have some elasticity (like compute), but the principle holds: **as PR volume increases, validation slows. If you're near capacity, faster authoring just shifts the bottleneck to validation without improving overall throughput.**

![chart visualizing the overall development lead time](/blog/images/articles/chart-development-lead-time-wrt-authoring-validation.avif)

**This is what Nx addresses.**

## **How Nx Shortens the Validation Phase and Increases Capability**

### **1\. Nx Provides an AI Agent that Automatically Fixes Broken PRs**

[Nx's Self-Healing CI](/docs/features/ci-features/self-healing-ci) is an **AI-powered system, which includes an Nx AI agent that automatically detects, analyzes, and proposes fixes for CI failures.**

![chart visualizing the overall development lead time](/blog/images/articles/self-healing-ci-workflow-simple.avif)

It samples the large amount of metadata Nx collects about your workspace to discern what is fixable from what is not. It can suggest and verify the fixes. In some cases, with the right configuration, will apply fixes automatically without developers having to do anything.

### **2\. Nx Increases Compute Capacity**

[Task caching](/docs/features/ci-features/remote-cache) and [task distribution](/docs/features/ci-features/distribute-task-execution) save 68% of CI compute on average, essentially tripling PR capacity with the same compute budget.

### **3\. Nx Reduces CI Time**

[Task caching](/docs/features/ci-features/remote-cache), [task distribution](/docs/features/ci-features/distribute-task-execution), and [automatic task splitting](/docs/features/ci-features/split-e2e-tasks) drastically reduce the average CI clock time.

### **4\. Nx Increases CI Reliability**

Enterprise projects often need dozens of VMs per CI run. Allocating VMs takes time, setup can fail, and a single failure fails the entire run.

[Nx works differently](/blog/reliable-ci-a-new-execution-model-fixing-both-flakiness-and-slowness). Results are shared between VMs.

Nx also automatically splits large tasks into smaller ones and deflakes them automatically. **With Nx, your CI fails for stable, actionable reasons.**

Nx also collects extensive workspace metadata to enable these features.

## **Results: Reduced Time to Green**

These features accomplish two things:

1. **Fewer iterations needed** to make PRs green - deflaking and self-healing reduce CI failures by up to 40%
2. **Cheaper iterations** - both in time and compute delivered by Nx's cache, distribution, and task splitting.

For large projects, time-to-green drops by 20-50%.

## **Summary**

PRs will soon be easier to author than to merge. For many teams where **validation isn't a bottleneck today, it will be next year**.

The AI revolution will noticeably decrease PR authoring time, creating more PRs. But validation has received less attention. That's changing. The [latest DORA report](https://services.google.com/fh/files/misc/2025_state_of_ai_assisted_software_development.pdf) showed teams merge more PRs with AI, but it increases delivery instability. Maintaining quality makes the validation phase even more critical.

**Nx addresses this directly**. It uses its agentic Self-Healing CI, among other capabilities, to reduce time-to-green, which substantially cuts development lead time and increases validation capacity.

---

Learn more:

- 🧠 [Nx AI Docs](/docs/features/enhance-ai)
- 🌩️ [Nx Cloud](/nx-cloud)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
