---
title: 'Monorepo Folder Structure'
description: 'How to structure a monorepo: flat vs grouped layouts, organizing by scope, library types, and changing the folder structure as teams evolve.'
filter: 'type:Guides'
featured: true
sidebar:
  label: Folder Structure
topics:
  - 'Organizational decisions'
---

A monorepo folder structure determines how quickly developers find code, how naturally ownership
boundaries fall, and how well tooling like affected detection maps changes to projects.
Nx works with any folder structure you choose, and the structures below are conventions that have
held up in large workspaces, not requirements.

## How should you structure a monorepo?

Two layouts cover most monorepos:

**Flat layout** - every project sits directly under one folder, usually `packages/`.
This is the default shape of package manager workspaces, and it works well when projects are
published packages or when the count stays small enough to scan.

{% filetree %}

- packages/
  - eslint-config/
  - ui-components/
  - web-app/
  - website/

{% /filetree %}

**Grouped layout** - applications live under `apps/`, reusable code under `libs/`, with grouping
folders inside.
This fits product-focused workspaces where a handful of applications sit on top of many internal
libraries.

{% filetree %}

- apps/
  - booking/
  - check-in/
- libs/
  - booking/
    - feature-shell/
  - check-in/
    - feature-shell/
  - shared/
    - ui-components/

{% /filetree %}

Both layouts work with any package manager and with Nx.
The flat layout optimizes for simplicity, the grouped layout for navigability at scale: once a
workspace passes a few dozen projects, one flat folder stops communicating anything about how the
code relates.

## Keep applications thin

In the grouped layout, an application project contains the deployable shell: entry point,
configuration, and composition of features.
The features themselves live in libraries.
A common target is the majority of your code in `libs/`, with `apps/` reduced to wiring.

Thin applications keep code reusable by default (a feature built as a library can move between
applications), make boundaries enforceable (libraries have defined public APIs, application
internals don't), and give [affected detection](/docs/features/ci-features/affected) smaller
units to work with.

## Group projects by scope

Group libraries by the application or business domain they serve, not by their technical type.
Projects that change together should sit together, which keeps navigation short and makes
ownership obvious.

Using Acme Airlines as an example: projects related to the `booking` application group under
`libs/booking`, projects for `check-in` under `libs/check-in`, and projects used by both under
`libs/shared`.
Grouping folders can nest as domains grow (`libs/shared/seatmap`).

{% filetree %}

- apps/
  - booking/
  - check-in/
- libs/
  - booking/ <---- grouping folder
    - feature-shell/ <---- project
  - check-in/
    - feature-shell/
  - shared/ <---- grouping folder
    - data-access/ <---- project
    - seatmap/ <---- grouping folder
      - data-access/ <---- project
      - feature-seatmap/ <---- project

{% /filetree %}

The folder a project lives in becomes a code-ownership boundary: a `CODEOWNERS` entry per
grouping folder assigns each domain to its team.
See [code ownership](/docs/kb/code-ownership) for the setup.

## Name libraries by type

Within a domain, a small vocabulary of library types keeps the purpose of each project readable
from its name:

| Type            | Contains                                                   | Can depend on     |
| --------------- | ---------------------------------------------------------- | ----------------- |
| **feature**     | Smart components implementing a use case, routing, screens | Any type          |
| **ui**          | Presentational components with no application state        | ui, util          |
| **data-access** | API clients, state management, business logic              | data-access, util |
| **util**        | Pure functions, types, and helpers with no framework state | util              |

A path like `libs/booking/feature-shell` or `libs/shared/seatmap/data-access` then tells you the
domain and the role before you open a file.
The dependency column is a starting-point policy: tag each project with its type and scope, and
[module boundary rules](/docs/features/enforce-module-boundaries) enforce it, so a `ui` library
reaching into `data-access` fails at lint time instead of in review.

How finely to slice libraries is its own decision, covered in
[project size](/docs/kb/project-size).

## Share code deliberately

A shared grouping folder (`libs/shared`) holds code multiple domains consume: the design system,
API clients for common services, utilities.
Sharing is a monorepo's [core benefit](/docs/kb/what-is-a-monorepo), and it deserves a little
friction: code in `shared` has every domain as a consumer, so changes there affect everything and
its owners field cross-team requests.
Promote a library into `shared` when a second domain needs it, rather than starting everything as
shared.

## Can you change the folder structure later?

Yes. Don't be too anxious about choosing the exact right structure from the beginning.
Moving or renaming a project folder is a regular `mv`, and deleting one is a regular `rm`, the
same as in any repository.
Tooling doesn't factor into the decision, so pick the structure that helps developers find
things, and change it when your organization changes.
