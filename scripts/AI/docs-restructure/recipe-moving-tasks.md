# Recipe Navigation Restructuring

This file tracks the process of moving technology-specific recipes from the main "Recipes" section in `docs/map.json` to their appropriate "Technologies" sub-sections.

## Completed Tasks

## In Progress Tasks

- [x] Extract all items from Recipes > React and insert into Technologies > React > Core > Recipes
- [x] Extract all items from Recipes > Angular and insert into Technologies > Angular > Core > Recipes
- [x] Extract all items from Recipes > Angular Rspack and insert into Technologies > Angular > Angular Rspack > Recipes
- [x] Extract all items from Recipes > Node and insert into Technologies > Node.js > Core > Recipes
- [x] Extract all items from Recipes > Storybook and insert into Technologies > Testing Tools > Storybook > Recipes
- [x] Extract all items from Recipes > Cypress and insert into Technologies > Testing Tools > Cypress > Recipes
- [x] Extract all items from Recipes > Next and insert into Technologies > React > Next > Recipes
- [x] Extract all items from Recipes > Nuxt and insert into Technologies > Vue > Nuxt > Recipes
- [x] Extract all items from Recipes > Vite and insert into Technologies > Build Tools > Vite > Recipes
- [x] Extract all items from Recipes > Webpack and insert into Technologies > Build Tools > Webpack > Recipes
- [x] Remove now-empty technology-specific sub-sections from Recipes
- [x] Extract TypeScript-related items from Tips and tricks and insert into Technologies > TypeScript > Recipes:
  - "Switch to Workspaces and TS Project References"
  - "Enable Typescript Batch Mode"
  - "Define Secondary Entrypoints for Typescript Packages"
  - "Compile Typescript Packages to Multiple Formats"
  - "Use JavaScript instead TypeScript"
- [x] Extract ESLint-related items from Tips and tricks and insert into appropriate ESLint sections:
  - "Configuring ESLint with Typescript"
  - "Switching to ESLint's flat config format"

## Future Tasks

## Implementation Plan

- For each technology-specific section under the main Recipes section in `docs/map.json`, move its items to the corresponding Recipes sub-section under the appropriate technology in the Technologies section. See `scripts/AI/docs-restructure/recipe-mapping.md` for details on the mapping.
- If a Recipes sub-section does not exist for a technology, leave the recipes in place and list them for review.
- Remove the now-empty technology-specific sub-sections from the main Recipes section.
- Update this file as each task is completed.

### Relevant Files

- docs/map.json – Main documentation navigation structure (to be updated)
- scripts/AI/docs-restructure/recipe-moving-tasks.md – This task list and progress tracker
