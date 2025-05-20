# Nx Documentation Restructure – MVP Implementation

This file tracks the progress of the MVP documentation restructure as described in PRD.txt.

## Completed Tasks

- [ ] (none yet)

## In Progress Tasks

## Future Tasks

- [ ] Refactor "Getting Started" section: Introduction, Quick Start, Installation, Editor Integration (rename from "Editor Setup" everywhere except URL), How Nx Works
- [ ] Create "Technologies" section in sidebar and docs structure
- [ ] Audit all technologies: Ensure every technology listed in the implementation plan is present in the sidebar and docs structure
- [ ] Move technology-specific recipes from global "Recipes" to their respective technology section
- [ ] Audit and tag all recipes as "core" or "technology-specific" before moving
- [ ] Rename the current "Recipes" section to "Core Recipes" section
- [ ] Set and test default expanded/collapsed state for all sidebar sections
- [ ] Remove index pages; update navigation logic so section titles expand/collapse and open first doc
- [ ] Add technology icons to sidebar entries (reuse from `/nx-api` or create new SVGs)
- [ ] Update sidebar visual style for a more modern look and ensure icon consistency
- [ ] Audit and update all redirects for new/removed/renamed pages
- [ ] Test navigation, links, and content placement for correctness
- [ ] End-to-end QA: manual and automated tests for navigation, sidebar, and content
- [ ] Update or create contributor documentation describing the new structure, how to add technologies/recipes, and sidebar maintenance
- [ ] QA and release

## Implementation Plan

- Start by updating the sidebar structure in `docs/map.json` (specifically the "nx-documentation" node) to match the new hierarchy and collapsibility requirements.
- When making changes to the navigation structure in `docs/map.json`, ensure that corresponding updates are made to `redirect-rules.js` and `menu.utils.ts` to maintain correct navigation, avoid broken links, and preserve SEO. This is an integral part of any navigation change, not a separate task.
- Refactor the "Getting Started" section to follow the new structure and content guidelines, including renaming "Editor Setup" to "Editor Integration" (except for the URL).
- Audit all technologies and ensure the sidebar/docs structure matches the full list in the implementation plan.
- Audit all recipes, tag as "core" or "technology-specific", and move to their appropriate locations: technology-specific recipes under their technology, core recipes under "Core Recipes".
- Set and test the default expanded/collapsed state for all sidebar sections.
- Add technology icons to sidebar entries for improved visual navigation and ensure icon consistency.
- Remove index pages and update navigation logic so clicking a section expands/collapses it and opens the first doc.
- Update the sidebar's visual style for a modern, clean look.
- Test all navigation, links, and content placement thoroughly.
- Conduct end-to-end QA (manual and automated) for navigation, sidebar, and content.
- Update or create contributor documentation for the new structure and maintenance.
- Conduct QA and release the changes.

### Relevant Files

- scripts/AI/docs-restructure/PRD.txt – Product requirements and scope
- docs/map.json – Sidebar and navigation structure
- scripts/AI/docs-restructure/F - Polyglot docs - Implementation Plan.md – Detailed structure notes
- scripts/AI/docs-restructure/TASKS.md – This task list
- docs/shared/getting-started/intro.md – "Getting Started" content
- docs/shared/getting-started/installation.md – Installation content
- docs/shared/getting-started/editor-setup.md – Editor integration content
- docs/redirect-rules.js – Redirect rules for navigation
- nx-dev/data-access-menu/src/lib/menu.utils.ts – Menu utility logic
- CONTRIBUTING.md or similar – Contributor documentation
