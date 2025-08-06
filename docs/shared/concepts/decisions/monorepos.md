---
title: Monorepos
description: Monorepos enable seamless code sharing, atomic changes, and consistent development practices across projects.
---

# Monorepos

A **monorepo stores code for multiple projects in a single version-controlled repository**, enabling teams to share code seamlessly, make atomic changes across project boundaries, and maintain consistent development practices at scale. This approach fundamentally changes how organizations structure their codebases and collaborate on software development.

## What is a monorepo?

A monorepo represents a different approach to organizing code compared to the traditional model of one _repository per project_ (often also called "polyrepo"). In a monorepo, **multiple distinct projects (applications, libraries, services, and tools) coexist in a single repository while remaining logically independent**.

The mental model shifts from isolated projects to a **shared workspace where teams collaborate within clear boundaries**. Like a well-organized office building where each team occupies its own floor while sharing common facilities and following building-wide standards.

Here is some key terminology often used with monorepos:

- A **workspace** encompasses the entire monorepo structure
- **Projects** represent individual applications, libraries, or services within that workspace
- **Source dependencies** compile directly from code within the repository, eliminating the need for package registries between internal projects
- The **project graph** maps relationships between projects which enables tools to determine which changes affect which components

Common myths about monorepos include:

- **Monorepos are monoliths** - They can contain any architectural pattern. A monorepo can host anything from a monolith to a microservice or microfrontend.
- **Everything must be released together** - Modern monorepos support independent release cycles. Atomic commits enable coordinated changes during development but don't necessarily require synchronized deployments.
- **You need one massive repository** - Unlike Google and Meta, most companies don't have a single organization-wide monorepo. Instead, they might have multiple monorepos hosting projects that are related from a business perspective and where fast iteration and collaboration is beneficial.
- **Other teams will break your code** - Proper tooling like CODEOWNERS files provides directory-level access control.

## Why have a monorepo

The advantages of monorepos address some of the most persistent challenges in software development, particularly around **integration and collaboration**.

### Atomic commits across projects

Atomic commits eliminate coordination complexity that plagues multi-repository setups. Engineers can **make changes spanning modules atomically in just one commit** instead of coordinating releases across multiple repositories. Not only does this cut implementation times drastically but also allows for better upfront integration testing.

### Simplifying dependency management

A monorepo eliminates internal package versioning complexity by enabling projects to **consume shared code directly from source**. Instead of the time-consuming workflow of publishing preview versions and coordinating releases across repositories, teams work directly with the latest source code. This accelerates development cycles and removes the overhead of managing internal package registries.

### Breaking down silos and improving collaboration

Collaboration barriers dissolve when code visibility increases. Engineers can gain a deeper understanding of dependencies. **The real value lies in improving communication and integration** by clearly seeing integration points with other software parts, leading to better system design, faster cross-service feature development, reduced code duplication through visible shared libraries, and more consistent development practices across teams.

### Eliminating waste through consolidation

Monorepos excel at **identifying and eliminating duplication** that often goes unnoticed in polyrepo setups. **Code-level** duplication becomes visible and consolidatable. **Infrastructure-level** waste disappears through **CI pipelines, deployment scripts, and development tooling** set up once at the workspace level, with new projects automatically inheriting existing infrastructure. **Configuration standardization** through shared linting rules, testing frameworks, and build processes reduces maintenance overhead across repositories.

### Enhancing developer mobility

Monorepos provide **consistent building and testing workflows** across applications written with different tools and technologies. Developers gain confidence to **contribute to other teams' applications** without navigating disparate development environments, toolchains, or testing procedures. This uniformity enables engineers to **verify their changes are safe** using familiar commands and processes, regardless of the underlying technology stack, fostering cross-team collaboration and reducing the learning curve when working across different parts of the system.

## When to adopt a monorepo

Contrary to popular belief, monorepos aren't just for large organizations. The decision should be based on team needs, project relationships, and organizational culture rather than size alone. **Small teams and startups** benefit from faster iteration and reduced overhead of managing multiple repositories. **Growing teams (20-100 developers)** often hit the sweet spot with sufficient coordination benefits to justify tooling investment. **Large organizations** benefit through enhanced collaboration, breaking down silos, avoiding duplication, enforcing consistency, and centralized dependency management.

## Overcoming downsides of monorepos

While monorepos offer significant advantages, they introduce challenges that require thoughtful solutions, particularly as organizations scale.

### Build performance and scaling

Traditional build systems that rebuild entire repositories for small changes quickly become unusable. **You cannot just rebuild everything every time**. Nx solves this through [dependency graph analysis](/features/explore-graph), [building only affected projects](/ci/features/affected), intelligent [caching](/features/cache-task-results) (reusing build artifacts when inputs haven't changed), and [distributed execution](/ci/features/distribute-task-execution) (parallelizing tasks across multiple machines or CI agents).

### Enforcing boundaries

In a monorepo, the physical separation between repositories disappears, requiring **mechanisms to enforce logical boundaries that don't exist anymore**. Without proper tooling, teams might accidentally create inappropriate dependencies between projects that should remain independent. Nx provides solutions through [module boundary rules](/features/enforce-module-boundaries) that prevent unauthorized imports and maintain the logical separation between different domains, libraries, and applications within the same repository.

### Managing ownership and access control

Large monorepos need **mechanisms for managing and enforcing ownership** to prevent chaos as teams grow, including code ownership (defining who can approve changes), access control (protecting sensitive code), and review processes (workflows that scale with team size). Modern platforms and tools address these needs through CODEOWNERS files, automated review assignment, and [CODEOWNERS integration](/nx-enterprise/powerpack/owners) for directory-level access control.
