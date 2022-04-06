# Nx and Yarn/Lerna (Workspaces for Publishing NPM Packages)

> In our teams we see a shift away from Lerna and a strong preference to use Nx for managing JavaScript-based monorepos.
> [Thoughtworks Technology Radar 2021](https://www.thoughtworks.com/en-ca/radar/tools/nx)

- Want to know how to create a **new** Nx workspace and use Lerna/Yarn with it, check out [Using Nx Core Without Plugins](/getting-started/nx-core).
- Want to add Nx to an existing Lerna/Yarn/PNPM mononorepo, check out [Adding Nx to Lerna/Yarn/PNPM/NPM Workspace](/migration/adding-to-monorepo).
- Want to build a publishable TS/JS library, checkout [Nx and TypeScript](/getting-started/nx-and-typescript).

This guide clarifies some misconceptions about how Nx and Lerna/Yarn relate.

## Nx and Lerna/Yarn Workspaces

Nx has more in common with the build tools used at Google or Facebook (just made a lot more easily accessible for other
companies) than with tools like Yarn Workspaces or Lerna. When using the word "monorepo" in the context of say Google,
we imagine a much richer dev experience, not simply collocating a few projects side-by-side.

Lerna/Yarn/PNPM are package managers. When it comes to monorepos, they mainly perform `node_modules` deduping. So the
choice isn't between Nx or Yarn Workspaces. It's between whether you want to have multiple `node_modules` folders (in
this case use Nx with Yarn Workspaces) or not (use Nx without Yarn Workspaces).

### Misconception: You have to choose between Nx and Yarn Workspaces/Lerna.

Lerna, Yarn workspaces, pnpm workspaces offer the following affordances for developing multiple projects in the same
repo:

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

As you can see, there is basically no overlap. Nx isn't a package manager (it's not a JS-only tool),
so deduping `node_modules` isn't in that list. Nx doesn't care whether your repo has multiple node_modules folders or
not, or whether you choose to dedupe them or not. In fact, many companies use Nx and Yarn Workspaces together to get
the benefits of both. If you want to use Yarn Workspaces to dedupe `node_modules` in your Nx workspace, you can do it.
Many companies do.

What often happens though is when folks adopt Nx, they have better affordances for implementing a single-version
policy (why this is a good idea is beyond the scope of this post, but you can read more about why Google does [here](https://cacm.acm.org/magazines/2016/7/204032-why-google-stores-billions-of-lines-of-code-in-a-single-repository/fulltext)). But
it's important to stress that this isn't required by Nx. It's simply something that Nx can enable you to do at scale.

### Misconception: Nx is only for apps

If you do something well, folks assume that the only thing you can do. Nx is equally suited for publishable npm packages
as it is for applications.

For instance, the Nx repo itself is built with Nx. It has 2 applications and a few dozen libraries. Those libraries are
published to NPM.

### Misconception: Nx is "all-in"

While Nx does have many plugins, each of them is optional. If you check out [Using Nx Core Without Plugins](/getting-started/nx-core), you will see that Nx at its core is very minimal. Much like VS Code, Nx is very minimal but can easily be extended by adding plugins. Saying this is akin to saying that VS Code is "all in". The fullness and richness of the experience depends on how many plugins you choose to use. You could install a lot of Nx Plugins that will do a lot of the heavy lifting in, for instance, connecting your Next.js, Storybook and Cypress. You could but you don't have to.

### Misconception: Nx is configuration over convention

If you only use Nx core, the only extra piece configuration you get is `nx.json` at the root.

Everything else you see in guides is optional. You can choose to configure your executors instead of using npm scripts, or configure generator defaults, and so forth. When you configure the `@nrwl/web:dev-server` executor, though, you aren't just adding a chunk of json config into `project.json`, you are also removing the configuration files you used to implement the same functionality (start
scripts, Webpack config files etc.) So the total amount of configuration is decreasing, and, often, by a lot.
