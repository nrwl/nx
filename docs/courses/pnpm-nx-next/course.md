---
title: 'From PNPM Workspaces to Distributed CI'
description: 'Learn how to transform a PNPM workspace monorepo into a high-performance distributed CI setup using Nx.'
authors: [Juri Strumpflohner]
repository: 'https://github.com/nrwl/nx-course-pnpm-nx'
order: 2
---

In this course, we'll walk through a step-by-step guide using the Tasker application as our example. Tasker is a task management app built with Next.js, structured as a PNPM workspace monorepo. The monorepo contains the Next.js application which is modularized into packages that handle data access via Prisma to a local DB, UI components, and more.

Throughout the course, we'll take incremental steps to enhance the monorepo:

1. Adding Nx
2. Configuring and fine-tuning local caching
3. Defining task pipelines to ensure correct task execution order
4. Optimizing CI configuration with remote caching
5. Adjusting the current CI configuration to enable task distribution
6. Splitting and parallelizing Playwright e2e tests to reduce execution time from 20 minutes to 9 minutes
