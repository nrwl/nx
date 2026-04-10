---
title: 'Managing Configuration Files'
description: 'Learn how Nx helps manage different types of configuration files in your workspace, including both Nx-specific and tool-specific configurations at global and project levels.'
---

# Managing Configuration Files

Besides providing caching and task orchestration, Nx also helps incorporate numerous tools and frameworks into your repo. With all these pieces of software commingling, you can end up with a lot of configuration files. Nx plugins help to abstract away some of the difficulties of managing this configuration, but the configuration is all still accessible, in case there is a particular setting that you need to change.

## Different Kinds of Configuration

When discussing configuration, it helps to categorize the configuration settings in two dimensions:

- **Type** - The two different types we'll discuss are Nx configuration and tooling configuration. Tooling can be any framework or tool that you use in your repo (i.e. React, Jest, Playwright, Typescript, etc)
- **Specificity** - There are two different levels of specificity: global and project-specific. Project-specific configuration is merged into and overwrites global configuration.

For example, Jest has a global `/jest.config.ts` file and a project-specific `/apps/my-app/jest.config.ts` file that extends it.

|                  | Nx                          | Tooling                       |
| ---------------- | --------------------------- | ----------------------------- |
| Global           | `/nx.json`                  | `/jest.config.ts`             |
| Project-specific | `/apps/my-app/project.json` | `/apps/my-app/jest.config.ts` |

## How Does Nx Help Manage Tooling Configuration?

In a repository with many different projects and many different tools, there will be a lot of tooling configuration. Nx helps reduce the complexity of managing that configuration in two ways:

1. Abstracting away common tooling configuration settings so that if your project is using the tool in the most common way, you won't need to worry about configuration at all. The default settings for any Nx plugin executor are intended to work without modification for most projects in the community.
2. Allowing you to [provide `targetDefaults`](/recipes/running-tasks/reduce-repetitive-configuration) so that the most common settings for projects in your repo can all be defined in one place. Then, only projects that are exceptions need to overwrite those settings. With the judicious application of this method, larger repositories can actually have less lines of configuration after adding Nx than before.

## Determining the Value of a Configuration Property

If you need to track down the value of a specific configuration property (say `runInBand` for `jest` on the `/apps/my-app` project) you need to look in the following locations. The configuration settings are merged with priority being given to the file higher up in the list.

1. In `/apps/my-app/project.json`, the `options` listed under the `test` target that uses the `@nx/jest:jest` executor.
2. In `/nx.json`, the `targetDefaults` listed for the `test` target.
3. One of the `test` target options references `/apps/my-app/jest.config.ts`
4. Which extends `/jest.config.ts`

```text
repo/
├── apps/
│   └── my-app/
│       ├── jest.config.ts
│       └── project.json
├── jest.config.ts
└── nx.json
```

## More Information

- [Nx Configuration](/reference/nx-json)
- [Project Configuration](/reference/project-configuration)
