---
title: 'Combining Predictability and Intelligence With Nx Generators and AI'
slug: nx-generators-ai-integration
authors: ['Juri Strumpflohner']
tags: ['nx', 'nx-console', 'ai']
cover_image: /blog/images/articles/bg-llm-nx-generators.avif
description: 'Learn how you can combine the predictability of Nx generators code generators with the intelligence of LLMs which are able to integrate them into your workspace specific context.'
youtubeUrl: https://youtu.be/PXNjedYhZDs
---

{% callout type="deepdive" title="Series: Making your LLM smarter" expanded=true %}

- [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter)
- [Making Cursor Smarter with an MCP Server For Nx Monorepos](/blog/nx-made-cursor-smarter)
- [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot)
- [Nx and AI: Why They Work so Well Together](/blog/nx-and-ai-why-they-work-together)
- [Save Time: Connecting Your Editor, CI and LLMs](/blog/nx-editor-ci-llm-integration)
- **Enhancing Nx Generators with AI: Predictability Meets Intelligence**
- [Your AI Assistant Can Now Read Your Terminal: Real-Time Development Error Fixing](/blog/nx-terminal-integration-ai)
- [Introducing Self-Healing CI for Nx and Nx Cloud](/blog/nx-self-healing-ci)
- [Analyze Your Nx Cloud Runs With Your AI Assistant](/blog/nx-cloud-analyze-via-nx-mcp)
- [Automatically Fix your CI Failures with JetBrains AI Assistant](/blog/jetbrains-ci-autofix)

{% /callout %}

In a world where AI coding assistants are increasingly capable of generating entire applications from scratch, you might wonder: **what's the point of code generators anymore?** At Nx, we've been thinking about this exact question, exploring the combination of predictable code generators with intelligent LLMs to create an improved developer experience.

Lets dive in how this works.

{% toc /%}

## The Value of Predictability in Code Generation

Nx plugins often come with code generators that create new projects, libraries, or components following best practices. For example, the `@nx/react` plugin includes generators for scaffolding React applications and libraries with the correct structure and configuration, taking away a lot of the low-level configuration and setup burden.

```shell
nx g @nx/react:lib packages/some-lib
```

These generators guide you through a series of prompts and then scaffold out a project with a clean, predictable structure. Unlike **AI-generated code that might vary with each prompt, generators produce consistent results every time**.

This predictability is particularly valuable in enterprise settings where:

- Teams need to maintain consistent coding standards
- New libraries should follow established architectural patterns
- Customized setups need to be reproducible across projects

We see a lot of Nx users either tailor existing generators to their needs or [create entirely custom ones](/extending-nx/recipes/local-generators), ensuring that new code follows team standards perfectly.

## Where AI Shines: Context and "Intelligence"

While generators excel at predictability, they lack awareness of your workspace context. Imagine the example of generating a new React library but also to import the main component of that library into an existing project. You can totally encode that behavior but

- it is costly to implement, needing to account for all sorts of special edge cases
- it adds additional configuration burden on the user's side which needs to provide the applictions name and location in the workspace structure

This is where AI assistants prove invaluable. An LLM assistant is perfectly able to take the generated output, interpret it and use the Nx MCP to

1. Understands your workspace structure and project relationships
2. Identify the application the library should be connected to
3. Adjust the source code and make the necessary changes

## How This Works: LLM Handing Control Over to a Human

> When vibe coding you just iterate fast and backtrack but in a real world enterprise environment you might want more control over the flow, inspecting intermediate values and being in a constant conversation with the LLM.

If we ignore "vibe coding" for a moment (where you want to iterate fast and backtrack), in a real-world enterprise setting you want more control staying in a conversation with the AI assistant and being able to adjust values or course correct.

Our latest enhancement creates a seamless workflow between LLMs and generators:

1. You describe what you want to create to your AI assistant
2. The assistant uses the Nx MCP server to identify available generators
3. It selects the appropriate generator and configurations
4. Instead of running it directly, it opens the Nx Console Generate UI
5. You can review and adjust the options before generating
6. After generation, the assistant helps integrate the new code with your existing projects

Let's dive into how this works based on an example. Instead of manually invoking the generator yourself, you let the coding assistant drive the interaction by asking something like:

```plaintext
Create a new React library into the packages/orders/feat-cancel-orders folder
and call the library with the same name of the folder structure. Afterwards,
also connect it to the main shop application and make sure you link the
library properly in the package.json of the main shop application.
```

> Note there's two different parts here: the first part that can be perfectly satisfied by an Nx generator, and the 2nd part (`Afterwards, also connect it to the main shop application...`) where the intelligence of the LLM comes in that is able to connect the resulting code to your codebase.

Your coding assistant (in this case VSCode Copilot) invokes the [Nx MCP](/features/enhance-AI) to better understand the underlying workspace structure and then invokes the MCP's tools for code generation:

- `nx_generators` - Returns a list of available generators in the workspace
- `nx_generator_schema` - Provides detailed schema information for a specific generator such as the available options that can be provided to a generator

This allows the LLM to map the user query onto an available Nx generator options. But **instead of invoking the generator directly our new flow hands control over to the developer** for inspecting the values and potentially making adjustments.

![LLM invoking the Nx generate UI](/blog/images/articles/llm-nx-generate-ui.avif)

Meanwhile, the LLM waits to continue. Once you as a developer confirm and run the generator via the Nx Console UI, the LLM gets a message sent and continues its execution **making contextual decisions based on your workspace structure**. In our example, it automatically connects the new library to the existing data access and UI libraries (aligning it with other libraries that are already in the workspace) and connecting it to the main application.

This workflow combines the predictability of generators with the intelligence of AI, while keeping you in control of the process.

## Why This Approach Works So Well

This integration addresses several key challenges:

1. **Predictability and Intelligence**: You get the consistency and predictability of generators with the customization abilities of AI.

2. **Speed vs. Control**: The process is fast but keeps you in control through the Nx Generate UI.

3. **Context Awareness and Deep Integration**: The AI understands your workspace architecture and can make appropriate adjustments to the generated code to deeply integrate it into your workspace.

As [Victor noted in his recent post](/blog/nx-and-ai-why-they-work-together):

> "LLMs excel at impressive demonstrations but struggle with consistency and correctness... Being able to access a large library of annotated generators helps LLMs reduce variability of what they generate, which improves consistency and quality. They use a generator and make some small modifications on top instead of trying to author everything from scratch."

## Getting Started and Looking Forward

To use this feature, you'll need:

1. [Nx Console](/getting-started/editor-setup) installed in VSCode or Cursor (we're working on IntelliJ)
2. The [Nx MCP server configured](/features/enhance-AI) for your editor

Once set up, you can start leveraging this powerful combination of predictable generators and intelligent AI assistance.

This integration is just one example of our broader vision for AI-enhanced development with Nx, providing useful and deep integration of LLMs into your development workflow. Currently we're looking into integrating our [new Nx terminal UI](/blog/nx-21-terminal-ui) with your coding assistant, allowing for some interesting new AI powered workflows.

That said, don't forget to subscribe to our [YouTube channel](https://www.youtube.com/@nxdevtools) or [subscribe to our newsletter](https://go.nx.dev/nx-newsletter) for future announcements and demonstrations.

---

Learn more:

- 🧠 [Nx AI Docs](/features/enhance-AI)
- 🛠️ [Nx Generators](/features/generate-code)
- 👩‍💻 [Nx GitHub](https://github.com/nrwl/nx)
- 👩‍💻 [Nx Console GitHub](https://github.com/nrwl/nx-console)
- 💬 [Nx Official Discord Server](https://go.nx.dev/community)
- 📹 [Nx Youtube Channel](https://www.youtube.com/@nxdevtools)
