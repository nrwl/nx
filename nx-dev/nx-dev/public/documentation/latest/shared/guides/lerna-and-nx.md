# Lerna/Yarn and Nx

Nx has more in common with the build tools used at Google or Facebook (just made a lot more easily accessible for other companies) than with Lerna. When using the word "monorepo" in the context of say Google, we imagine a much richer dev experience, not simply collocating a few projects side-by-side.

Lerna/Yarn/PNPM are package managers. When it comes to monorepos, they mainly perform `node_modules` deduping. So the choice isn't really between Nx or Lerna. It's between whether you want to have multiple `node_modules` folders (in this case use Nx with Lerna) or not (use Nx without Lerna).

The following video 10-min video walks you through the steps of adding Nx to a Lerna repo and showing many affordances Nx offers. Although the video uses Lerna, everything said applies to Yarn or PNPM. Basically, any time you hear "Lerna" you can substitute it for Yarn or PNPM.

<iframe width="560" height="315" src="https://www.youtube.com/embed/BO1rwynFBLM" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>

## Clarifying Misconceptions

### Misconception: You have to choose between Nx and Lerna.

Lerna, Yarn workspaces, pnpm workspaces offer the following affordances for developing multiple projects in the same repo:

- Deduping node_modules. If I use the same version of say Next.js in all the projects, the package is installed once.
- Task orchestration. If I want to test all the projects, I can use a single command to do it.
- Publishing (Lerna only). I can run one command to publish packages to NPM.

This is what Nx offers:

- Smart rebuilds of affected projects
- Distributed task execution & computation caching
- Code sharing and ownership management
- High-quality editor plugins & GitHub apps
- Powerful code generators
- Workspace visualizations
- Rich plugin ecosystem
- Consistent dev experience for any framework
- Automatic upgrade to the latest versions of all frameworks and tools

As you can see, there is basically no overlap. Nx isn't a package manager (it's not a JS-only tool), so deduping `node_modules` isn't in that list. Nx doesn't care whether your repo has multiple node_modules folders or not, and whether you choose to dedup them or not. If you want to use Lerna to dedup `node_modules` in your Nx workspace, you can do it. Many companies do.

What often happens though is when folks adopt Nx, they have better affordances for implementing a single-version policy (why this is a good idea is beyond the scope of this post, but you can read more about why Google does here). But it's important to stress that this isn't required by Nx. It's simply something that Nx can enable you to do at scale.

### Misconception: Nx is for apps, Lerna is for libs.

Although it's true to say that the Nx core doesn't care whether you publish your packages or not, there are Nx plugins (e.g., `@nrwl/node`) that help you bundle and package your modules.

For instance, the Nx repo itself is built with Nx. It has 2 applications and a few dozen libraries. Those libraries are published to NPM. Many larger organizations using Nx publish a subset of their libraries to their registry.

### Misconception: Nx is configuration over convention

As you saw in the video, the amount of the generated configuration is small. The `add-nx-to-monorepo` script generates the following per project:

```
"header": { "type": "library", "root": "packages/header" }
```

That is it. If you have 200 projects in your workspace, you will see 200 lines specifying projects' roots. Practically everything else you see is optional. You can choose to configure your executors instead of using npm scripts, or configure generator defaults, and so forth. When you configure the @nrwl/web:dev-server executor, though, you aren't just adding a chunk of json config into workspace.json, you are also removing the configuration files you used to implement the same functionality (start scripts, Webpack config files etc.) So the total amount of configuration is decreasing, and, often, by a lot.

We came from Google, so we take the toolability very seriously. Nx plugins provide metadata to be understood by the Nx CLI and editors. The configuration of your workspace is also statically analyzable (in opposite to say the Webpack config files). In addition to enabling good VSCode and WebStorm support, it allows us to update your configuration automatically as you upgrade your version of Nx. Other than the toolability aspect we try to keep the config as short as possible and rely on conventions.
