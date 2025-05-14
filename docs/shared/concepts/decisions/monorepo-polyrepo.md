---
title: Monorepo or Polyrepo
description: Evaluate the organizational considerations for choosing between monorepo and polyrepo approaches, including team agreements on code management and workflows.
---

# Monorepo or Polyrepo

Monorepos have a lot of benefits, but there are also some costs involved. We feel strongly that the [technical challenges](/concepts/decisions/why-monorepos) involved in maintaining large monorepos are fully addressed through the efficient use of Nx and Nx Cloud. Rather, the limiting factors in how large your monorepo grows are interpersonal.

In order for teams to work together in a monorepo, they need to agree on how that repository is going to be managed. These questions can be answered in many different ways, but if the developers in the repository can't agree on the answers, then they'll need to work in separate repositories.

**Organizational Decisions:**

- [Dependency Management](/concepts/decisions/dependency-management) - Should there be an enforced single version policy or should each project maintain their own dependency versions independently?
- [Code Ownership](/concepts/decisions/code-ownership) - What is the code review process? Who is responsible for reviewing changes to each portion of the repository?
- [Project Dependency Rules](/concepts/decisions/project-dependency-rules) - What are the restrictions on dependencies between projects? Which projects can depend on which other projects?
- [Folder Structure](/concepts/decisions/folder-structure) - What is the folder structure and naming convention for projects in the repository?
- [Project Size](/concepts/decisions/project-size) - What size should projects be before they need to be split into separate projects?
- Git Workflow - What Git workflow should be used? Will you use trunk-based development or long running feature branches?
- CI Pipeline - How is the CI pipeline managed? Who is responsible for maintaining it?
- Deployment - How are deployments managed? Does each project deploy independently or do they all deploy at once?

## How Many Repositories?

Once you have a good understanding of where people stand on these questions, you'll need to choose between one of the following setups:

### One Monorepo to Rule Them All

If everyone can agree on how to run the repository, having [a single monorepo will provide a lot of benefits](/concepts/decisions/why-monorepos). Every project can share code and maintenance tasks can be performed in one PR for the entire organization. Any task that involves coordination becomes much easier.

Once the repository scales to hundreds of developers, you need to take proactive steps to ensure that your decisions about [code review](/concepts/decisions/code-ownership) and [project dependency restrictions](/features/enforce-module-boundaries) do not inhibit the velocity of your teams. Also, any shared code and tooling (like the CI pipeline or a shared component library) need to be maintained by a dedicated team to help everyone in the monorepo.

### Polyrepos - A Repository for Each Project

If every project is placed in its own repository, each team can make their own organizational decisions without the need to consult with other teams. Unfortunately, this also means that each team has to make their own organizational decisions instead of focusing on feature work that provides business value. Sharing code is difficult with this set up and every maintenance task needs to be repeated across all the repositories in the organization.

Nx can still be useful with this organizational structure. Tooling and maintenance tasks can be centralized through shared [Nx plugins](/concepts/nx-plugins) that each repository can opt-in to using. Since creating repositories is a frequent occurrence in this scenario, Nx [generators](/features/generate-code) can be used to quickly scaffold out the repository with reasonable tooling defaults.

### Multiple Monorepos

Somewhere between the single monorepo and the full polyrepo solutions exists the multiple monorepo setup. Typically when there are disagreements about organizational decisions, there are two or three factions that form. These factions can naturally be allocated to separate monorepos that have been configured in a way that best suits the teams that will be working in them.

Compared to the single monorepo setup, this setup requires some extra overhead cost - maintaining multiple CI pipelines and performing the same tooling maintenance tasks on multiple repositories, but this cost could be offset by the extra productivity boost provided by the fact that each team can work in a repository that is optimized for the way that they work.
