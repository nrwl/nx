---
title: Nx Console Project Details View
description: Learn how to use Nx Console's Project Details View to explore project information, run tasks, and navigate the dependency graph directly from your editor.
---

# Nx Console Project Details View

Nx Console provides seamless integration with the [Project Details View](features/explore-graph#explore-projects-in-your-workspace).
You can learn more about your project, run tasks or navigate the task graph with just a few clicks!

![console-pdv-example.png](/shared/images/nx-console/console-pdv-example.png)

You can access the integrated Project Details View in multiple ways:

- By clicking on the Preview icon to the top right of your `project.json`, `package.json` or any file that modifies targets (for example `jest.config.ts` or `cypress.config.ts`)
- By using the codelenses in any of these files
- By running the `Nx: Open Project Details to Side` action while any file in a project is open

In addition to viewing the Project Details View, Codelenses in tooling configuration files (like `jest.config.ts`) allow you to run targets via Nx with a single click.
If you would like to disable the Codelens feature, you can do so easily:

- In VSCode, simply turn off the `nxConsole.enableCodeLens` setting
- In JetBrains IDEs, right-click a Codelens and select `` Hide `Code Vision: Nx Config Files` Inlay Hints  ``
