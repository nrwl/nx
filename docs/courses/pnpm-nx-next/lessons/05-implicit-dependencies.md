---
title: 'Link an e2e Project with Its Web App Through Implicit Dependencies'
videoUrl: 'https://youtu.be/-iUHY27qUfE'
duration: '2:38'
---

One of the main capabilities of Nx is that it builds a project graph behind the scenes which it uses optimize how it runs your tasks. You can visualize the graph using:

```shell
pnpm nx graph
```

{% callout type="info" title="Install Nx Console" %}

You can also install **Nx Console** which is an extension for VSCode and IntelliJ that enhances the DX when working with Nx monorepos among which there's also the ability to visualize the project graph right in your editor window. Read more [about it here](/getting-started/editor-setup).

{% /callout %}

While most of the relationships are discovered by Nx automatically via `package.json` dependencies or JS/TypeScript imports, some cannot be detected. E2E projects such as the Playwright project in our workspace doesn't directly depend on our Next.js application. There is a dependency at runtime though, because Playwright needs to serve our Next application in order to be ablet to run its e2e tests.

![Implicit dependencies](/courses/pnpm-nx-next/images/implicit-dependencies.avif)

In this lesson, you'll learn how to define such dependencies using the `implicitDependencies` property.

## Relevant Links

- [Project configuration: implicitDependencies](/reference/project-configuration#implicitdependencies)
