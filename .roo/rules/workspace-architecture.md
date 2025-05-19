---
description: 
globs: 
alwaysApply: true
---

## Nx Documentation Overview

The main application is a Next.js based application living under "nx-dev/nx-dev". Look at the nx-dev/nx-dev/pages folder in particular to understand the routing structure of the Next application. It leverages packages from other libraries in "nx-dev/" such as "nx-dev/data-access-documents" or "nx-dev/data-access-menu" etc.

### Navigation structure

The navigation structure is given by the route-based navigation of the main Next.js app living in nx.dev/nx-dev/pages and nx-dev/nx-dev/app. In addition paths that map to the documentation content file are defined in [map.json](mdc:docs/map.json).

When updating the navigation structure, make sure to

- check [redirect-rules.js](mdc:nx-dev/nx-dev/redirect-rules.js) to make sure we don't mess up the current SEO
- [menu.utils.ts](mdc:nx-dev/data-access-menu/src/lib/menu.utils.ts) which contains some special cases about collapsible/non-collapsible parts

### Documentation content

The actual documentation is written in markdown in "docs/".

It is being copied to `nx-dev/nx-dev/public/documentation` by the `copy-docs` task defined in [project.json](mdc:nx-dev/nx-dev/project.json).
