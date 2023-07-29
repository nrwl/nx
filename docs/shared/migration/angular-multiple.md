# Migrating multiple Angular CLI workspaces into an Nx Monorepo

Migrating multiple Angular CLI workspaces into a single Nx monorepo involves some more manual steps and decisions to take.

- can we first align all apps to the same Angular version (e.g. using Angular CLI migrations)
- convert each of the apps into an easy to copy "Nx shape" (with `project.json` etc) using some of the before mentioned migration scripts
- copy everything into a new Nx workspace

Very often however we might also need to do it incrementally, such as

- migrating all apps into a monorepo
- keep them at different Angular & external dependency versions until everything is migrated
- migrate them one by one incrementally and over time

The following video tutorial walks you through such a scenario.

{% youtube
src="https://www.youtube.com/embed/M5NwkRNrpK0"
title="Nx Tutorial: Migrate Multiple Angular CLI apps into a Single Nx Monorepo"
width="100%" /%}
