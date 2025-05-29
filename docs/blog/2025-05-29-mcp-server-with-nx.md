---
title: 'Building an MCP Server with Nx'
slug: building-mcp-server-with-nx
authors: ['Max Kless']
tags: ['nx', 'mcp', 'ai', 'node']
cover_image: /blog/images/articles/bg-building-mcp-server.avif
description: 'Learn how to build a Model Context Protocol (MCP) server using Nx to make your applications AI-ready.'
---

Since the Model Context Protocol (MCP) [was released by Anthropic in late 2024](https://www.anthropic.com/news/model-context-protocol), it has quickly become an important part of the AI ecosystem. The [MCP provides an open standard](https://modelcontextprotocol.io/introduction) for connecting AI agents to the rest of the world - the web, software systems and developer tools, just to name a few examples.

We've been busy building the [Nx MCP server](/features/enhance-AI), which gives LLMs deep access to your monorepo's structure. It helps AI tools to better understand your workspace architecture, browse the Nx docs and even trigger actions in your IDE like executing generators or visualizing the graph.

{% youtube
src="https://www.youtube.com/watch?v=fPqPh4h8RJg"
title="The MCP Server that fixes CI for you"
width="100%" /%}

There are many examples of MCP servers for popular tools popping up all over the place. [Check out the official MCP repo](https://github.com/modelcontextprotocol/servers) to see a long list of reference servers as well as official and community integrations.

Whatever you're building, it's becoming more and more important to ensure that AI systems can interact with your software. So let's learn how to build your very own MCP server to make your technology be usable for AI - all from an Nx monorepo!

{% toc /%}

---

In this series of blog posts, we'll be using a fictional startup as an example: Astra Arcana - a bewitched SaaS company that lets you cast spells from anywhere with a few simple clicks.

![Screenshot of the Astra Arcana app visualizing a spell](/blog/images/2025-05-29/astra-arcana-screenshot.avif)

You can go and try casting some spells right away at [https://astra-arcana.pages.dev/](https://astra-arcana.pages.dev/)

Of course, like any modern software company, they need to be ready for the coming shift towards AI - let's help them by building an MCP server that lets you browse ingredients and cast spells directly from your AI chat!

---

## Setting up the Server

{% callout type="info" title="Code Along" %}
If you want to code along and build your own mcp server, clone the [https://github.com/MaxKless/astra-arcana](https://github.com/MaxKless/astra-arcana) repo on GitHub to get started.
{% /callout %}

Astra Arcana is built in an Nx monorepo, where the web app and api live. There's also a shared types library as well as the Typescript SDK, which lets users programmatically cast spells.

```
apps
 ├── web
 └── api
libs
 ├── spellcasting-types
 └── spellcasting-sdk
```

We will create a new Node application that contains our MCP server and use the Typescript SDK to power it.

### Creating the MCP Server

MCP are JSON-RPC servers that communicate with clients via stdio or http. Thankfully, [the official Typescript SDK](https://github.com/modelcontextprotocol/typescript-sdk) abstracts away large pieces of the implementation, making it easier to get started - let's get started by installing it.

```shell
npm install @modelcontextprotocol/sdk
```

We'll continue by installing the `@nx/node` plugin and using it to generate a new Node application:

```shell
npx nx add @nx/node
```

```shell
npx nx generate @nx/node:application --directory=apps/mcp-server --framework=none --no-interactive
```

This generates a basic node application:

```
UPDATE package.json
CREATE apps/mcp-server/src/assets/.gitkeep
CREATE apps/mcp-server/src/main.ts
CREATE apps/mcp-server/tsconfig.app.json
CREATE apps/mcp-server/tsconfig.json
UPDATE nx.json
CREATE apps/mcp-server/package.json
UPDATE tsconfig.json
```

In `package.json`, you'll see that Nx has configured a build and serve target for our app that uses `webpack`. Now that our setup is ready, let's implement the actual server.

First, let's import some things and set up an instance of `McpServer`. This is part of the MCP SDK and will take care of actually implementing the [Protocol Layer](https://modelcontextprotocol.io/docs/concepts/architecture#core-components) of the [MCP specification](https://modelcontextprotocol.io/specification/2025-03-26), for example how to communicate with the client.

```ts {% fileName="apps/mcp-server/src/main.ts" %}
import { SpellcastingSDK } from '@astra-arcana/spellcasting-sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({
  name: 'Astra Arcana',
  version: '1.0.0',
});
```

Next, we'll register a set of MCP tools. A tool is essentially a function that the AI model can call, passing some input parameters if necessary. Instead of constructing API calls manually, our tools will expose three main parts of casting a spell with the Spellcasting SDK: Ingredients, Incantations and Recipes. This is really the core piece of the MCP server, as it defines what it can do. There are [other features you can implement](https://modelcontextprotocol.io/docs/concepts/resources), but currently, tools are by far the most widely supported and important part.

```ts {% fileName="apps/mcp-server/src/main.ts" %}
const sdk = new SpellcastingSDK();

server.tool('get-ingredients', async () => {
  const ingredients = await sdk.getIngredients();
  return {
    content: [{ type: 'text', text: JSON.stringify(ingredients) }],
  };
});

server.tool('get-incantations', async () => {
  const incantations = await sdk.getIncantations();
  return {
    content: [{ type: 'text', text: JSON.stringify(incantations) }],
  };
});

server.tool('get-recipes', async () => {
  const recipes = await sdk.getRecipes();
  return {
    content: [{ type: 'text', text: JSON.stringify(recipes) }],
  };
});
```

Finally, let's implement the Transport Layer, letting the MCP server listen to and send messages via process inputs and outputs (stdio). It's only a few lines of code:

```ts {% fileName="apps/mcp-server/src/main.ts" %}
const transport = new StdioServerTransport();
(async () => {
  await server.connect(transport);
})();
```

And just like that, we've built our very own MCP server! Let's make sure it works.

## Testing with the MCP Inspector

Anthropic has not just come up with the protocol, they've also created [a great ecosystem around it](https://github.com/modelcontextprotocol): Various SDKs, reference servers and a visual testing tool: [The MCP Inspector](https://github.com/modelcontextprotocol/inspector).

Let's modify our serve target to use the Inspector, letting us explore our newly created server. First, delete the existing `serve` target in `apps/mcp-server/package.json` , as it doesn't really apply to our use case. Replace it with this

```json {% fileName="apps/mcp-server/package.json" %}
"serve": {
  "command": "npx -y @modelcontextprotocol/inspector node ./apps/mcp-server/dist/main.js",
  "dependsOn": ["build"],
  "continuous": true
}
```

Let's break it down:

- the command runs the Inspector, pointing to the build output location of our MCP server
- `"dependsOn": ["build"]` tells nx to always run the build before this target, making sure that the bundled javascript is available
- `"continuous": true` marks the serve as a [continuous task](/recipes/running-tasks/defining-task-pipeline#continuous-task-dependencies) so that will work properly in more complex task pipelines

You can see the result by running `npx nx serve mcp-server` and looking at the website it spins up (usually on [`http://localhost:6274`](http://127.0.0.1:6274/) ).

The sidebar contains all the information required to start the server - here the `STDIO` transport is correctly preselected as well as the command needed to start the server.

![Screenshot of the MCP Inspector sidebar](/blog/images/2025-05-29/mcp-inspector-sidebar.avif)

After clicking on the Connect button, the server is started in the background and you'll be able to see the available tools and call them under the `Tools` tab.

![Screenshot of the MCP Inspector showing the available tools](/blog/images/2025-05-29/mcp-inspector-tools.avif)

## Agents that can take actions

The `get-*` tools that we've built are already super useful and budding spellcasters will be glad to have help in perfecting their concoctions and learning ancient incantations. However, where the power of AI agents really starts to shine is when they go beyond just reading data and start taking actions. Let's give AI the ability to cast spells. 🪄

We'll register another tool in `apps/mcp-server/src/main.ts`

```ts {% fileName="apps/mcp-server/src/main.ts" %}
import { z } from 'zod';

// ... previous tools

server.tool(
  'cast-spell',
  'Lets the user cast a spell via the Astra Arcana API.',
  { ingredients: z.array(z.string()), incantations: z.array(z.string()) },
  async ({ ingredients, incantations }) => {
    const result = await sdk.castSpell(ingredients, incantations);
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
    };
  }
);
```

There are two key differences in this tool definition:

- We've passed a description string as the second argument. You can do this for every tool in order to describe what to use it for and what will happen when the agent calls it. `cast-spell` is sort of self-explanatory but it's still good practice to add a description and increase the model's chances of picking the right tool for the job. You can even add more annotations to mark a tool as read-only, destructive or more.
- We've passed an object that defines the shape of the input using [`zod`](https://zod.dev/). This lets the agent know how to structure the inputs that are passed to the tool. `ingredients` and `incantations` as arrays of strings aren't very complicated, but you could also add descriptions to each individual option to explain what it does. The full feature set of `zod` is available to define exactly what's possible with each tool.

Now, let's try it out in an actual agent. I'll use VSCode & GitHub Copilot for this but any agent implementation with MCP support will do. I really like [Windsurf](https://docs.windsurf.com/windsurf/getting-started) or [Cursor](https://www.cursor.com/), for example.

Register the MCP server by editing `.vscode/mcp.json` (or using the built-in command):

```json {% fileName=".vscode/mcp.json" %}
{
  "servers": {
    "astra-arcana": {
      "command": "node",
      "args": ["/path/astra-arcana/apps/mcp-server/dist/main.js"]
    }
  }
}
```

Once you open a Copilot chat in Agent mode, the MCP server will start automatically and you should see all four tools available

![Screenshot of the VSCode quickinput listing available MCP tools](/blog/images/2025-05-29/mcp-list-vscode.avif)

Let's try to cast a spell! For obvious reasons, I want to make sure that I'm writing high-quality blog posts and could use a magic boost. You can see that the AI agent uses all the tools to figure out what's available and then tries to cast the spell. Some models might ask for permission first or ask follow up questions to make sure they're getting it right.

![Screenshot of a conversation with Copilot that uses the built MCP tools](/blog/images/2025-05-29/copilot-using-tools.avif)

After casting, you can head over to [https://astra-arcana.pages.dev/](https://astra-arcana.pages.dev/) and check the logs to see your spell! 🎉

![Screenshot of the Astra Arcana app showing the cast spell in the browser](/blog/images/2025-05-29/astra-arcana-logs.avif)

## Publishing to npm

Of course, now that we've built our magical MCP server, we want to make sure people can use it easily. Let's go through the process of publishing an executable file to the npm registry. In the future, anyone will be able to run `npx @astra-arcana/mcp-server` and spin it up immediately!

{% callout type="note" title="Learn More About nx release" %}
This section goes over the release process of this specific example. If you want to learn how to use `nx release` in detail, I recommend checking out Juri's great course on the topic: https://www.epicweb.dev/tutorials/versioning-and-releasing-npm-packages-with-nx
{% /callout %}

### Publishing Pre-Requisites

In order to have our bundled code be executable via npx, we need to add a shebang (`#!/usr/bin/env node`) to the first line of the file. We'll make sure this is added in a new script in the `apps/mcp-server` directory called `setup-publish.js`.

```js {% fileName="apps/mcp-server/setup-publish.js" %}
import path from 'path';
import fs from 'fs';

const distDir = path.resolve(import.meta.dirname, './dist');
const distMainJsPath = path.resolve(distDir, 'main.js');
const mainJsContent = fs.readFileSync(distMainJsPath, 'utf8');
const shebang = '#!/usr/bin/env node\n';

if (!mainJsContent.startsWith(shebang)) {
  fs.writeFileSync(distMainJsPath, shebang + mainJsContent);
  console.log('Shebang added');
}

console.log('Setup completed successfully!');
```

We'll also set up a target that calls this script after making sure the main bundle is built.

```json {% fileName="apps/mcp-server/package.json" %}
"setup-publish": {
  "command": "node apps/mcp-server/setup-publish.js",
  "dependsOn": ["build"]
}
```

While we're in `package.json` , let's also make sure that our package is publishable and let `npx` and similar tools know where to find the executable javascript file.

```diff {% fileName="apps/mcp-server/package.json" %}
{
  "name": "@astra-arcana/mcp-server",
  "version": "0.0.1",
- "private": true,
+ "private": false,
+ "bin": "./main.js",
  // ...
```

### Local Publishing with Verdaccio

{% callout type="warning" title="Publishing" %}
Keep in mind that the `@astra-arcana/mcp-server` package already exists on the official npm registry, so we will only publish to a local registry.
{% /callout %}

At Nx, we use an awesome open-source tool called [Verdaccio](https://verdaccio.org/). It's a lightweight implementation of a local npm registry - let's use it to test out our publishing flow.

You can add verdaccio to the repo by running the `setup-verdaccio` generator:

```shell
npx nx g @nx/js:setup-verdaccio
```

This will create a verdaccio config and an nx target to spin it up at the root of our workspace. Start the local registry by running.

```shell
npx nx run @astra-arcana/source:local-registry
```

On [`http://localhost:4873/`](http://localhost:4873/) , you'll see an instance of verdaccio running with no packages published yet. Let's change that!

### Configuring Nx Release

Now that everything is set up, let's configure `nx release` to actually version our package, generate changelogs and publish to npm.

There are a couple of things we want to configure. Check out [the comprehensive release documentation](/features/manage-releases) to learn more about the different configuration options.

- Since we're in a monorepo with different kinds of packages, we have to let `nx release` know which ones to configure releases for - in this case, only the `mcp-server` app
- When releasing, we need to make sure that not only is the version in the repo's `package.json` is incremented, but also the version in the `dist` folder that we'll actually release from. We can do this by setting `manifestRootsToUpdate`.
- We have to make sure the `dist` folder exists, so we'll run our new `setup-publish` action first by specifying the command in `preVersionCommand` .
- Since our mcp server will be released independently, we configure the changelogs to be generated per-project instead of for the entire workspace.

```json {% fileName="nx.json" %}
"release": {
  "projects": ["mcp-server"],
  "version": {
    "manifestRootsToUpdate": [
      "{projectRoot}",
      "{projectRoot}/dist"
    ],
    "preVersionCommand": "npx nx run mcp-server:setup-publish"
  },
  "changelog": {
    "projectChangelogs": true,
    "workspaceChangelog": false
  }
}
```

This is enough to configure `nx release` for our exact use case. With this, we can run `npx nx release --dry-run` . Nx will run the `setup-publish` target, prompt you for the kind of version change that's happening and give you a preview of what the result would be.

![Screenshot of the version prompt asked by nx release](/blog/images/2025-05-29/nx-release-prompt.avif)

If you're happy with the results, rerun the command without `--dry-run` and watch as `nx release` does its _magic_. The versions will be updated across both `package.json` files, and a changelog file, a git commit and tag will be created.

In order to release to npm, we have to add some final configuration to `nx.json` .

```json {% fileName="nx.json" %}
"targetDefaults": {
  // ... other config
  "nx-release-publish": {
    "options": {
      "packageRoot": "{projectRoot}/dist"
    }
  }
}
```

This will tell the automatically generated `nx-release-publish` target where to find the built files so that it can publish them to npm (or verdaccio, in our case). After running `npx nx release publish` , refresh Verdaccio to see the successfully published package! 🎉 You can spin up the MCP server using the published version by running `npx @astra-arcana/mcp-server` and try it out.

That's it! You can view the `@astra-arcana/mcp-server` package on npm here: https://www.npmjs.com/package/@astra-arcana/mcp-server

## Looking back and into the Future

We've come a long way. Looking back, we've

- learned about the Model Context Protocol
- set up a node application and built an MCP server with it
- used the MCP Inspector to test and debug our implementation
- used AI agents to cast spells 🪄
- learned how to publish an executable package to npm

The next post in this series will dive into implementing a different MCP transport layer in streamable HTTP and hosting our server on Cloudflare!

---

Learn more:

- 📖️ [Blog: AI Series](/blog/nx-mcp-vscode-copilot)
- 🧠 [Nx AI Docs](/features/enhance-AI)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
