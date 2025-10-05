---
title: 'Enhance Your LLM'
description: 'Learn how Nx enhances your AI assistant by providing rich workspace metadata, architectural insights, and project relationships to make your LLM smarter and more context-aware.'
---

# Enhance Your LLM

{% youtube src="https://youtu.be/dRQq_B1HSLA" title="We Just Shipped the Monorepo MCP for Copilot" /%}

Monorepos **provide an ideal foundation for AI-powered development**, enabling cross-project reasoning and code generation. However, without proper context, **LLMs struggle to understand your workspace architecture**, seeing only individual files rather than the complete picture.

Nx's transforms your AI assistant by providing rich workspace metadata that enables it to:

- Understand your **workspace architecture** and project relationships
- Identify **project owners** and team responsibilities
- Access **Nx documentation** for accurate guidance
- Leverage **code generators** for consistent scaffolding
- Connect to your **CI pipeline** to help fix failures

The goal is to transform your AI assistant from a generic code helper into an architecturally-aware collaborator that understands your specific workspace structure and can make intelligent, context-aware decisions.

## How Nx MCP Enhances Your LLM

The [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) is an open standard that enables AI models to interact with your development environment through a standardized interface. Nx implements an MCP server via the [Nx Console](/getting-started/editor-setup) that exposes workspace metadata to compatible AI assistants like GitHub Copilot, Claude, and others.

With the Nx MCP server, your AI assistant gains a "map" of your entire system being able to go from just reasoning at the file level to seeing the more high level picture. This allows the LLM to move between different abstraction levels - from high-level architecture down to specific implementation details:

![Different abstraction levels](/blog/images/articles/nx-ai-abstraction-levels.avif)

These are some of the available tools which the Nx MCP server exposes:

- **`nx_workspace`**: Provides a comprehensive view of your Nx configuration and project graph
- **`nx_project_details`**: Returns detailed configuration for specific projects
- **`nx_docs`**: Retrieves relevant documentation based on queries
- **`nx_generators`**: Lists available code generators in your workspace
- **`nx_generator_schema`**: Provides detailed schema information for generators
- **`nx_visualize_graph`**: Opens interactive project or task graph visualizations
- **`nx_cloud_cipe_details`**: Returns information about CI pipelines from Nx Cloud
- **`nx_cloud_fix_cipe_failure`**: Provides detailed information about CI failures to help fix issues

## Setting Up Nx MCP

The Nx MCP server is part of Nx Console and can be easily configured in supported editors:

### VS Code Setup

For VS Code users, the MCP is configured **completely automatically** via the Nx Console extension:

1. Install [Nx Console](/getting-started/editor-setup) from the marketplace
2. The MCP server is automatically configured - no additional setup needed!

### Cursor / JetBrains Setup

For Cursor and JetBrains IDE users:

1. Install [Nx Console](/getting-started/editor-setup) from the marketplace
2. You'll receive a notification to "Improve Copilot/AI agent with Nx-specific context"
3. Click "Yes" to configure the MCP server

![VS Code showing the Nx MCP installation prompt](/blog/images/articles/copilot-mcp-install.avif)

If you miss the notification, run the `nx.configureMcpServer` (`Nx: Setup MCP Server` in JetBrains) command from the command palette (Cursor: `Ctrl/Cmd + Shift + P`, JetBrains IDEs: `Ctrl/Cmd + Shift + A`).

### Other MCP-Compatible Clients

For other MCP-compatible clients (that do not have Nx Console available) like Claude Desktop you can use the Nx MCP by configuring it manually as follows:

```json {% fileName="mcp.json" %}
{
  "servers": {
    "nx-mcp": {
      "command": "npx",
      "args": ["nx-mcp@latest"]
    }
  }
}
```

For Claude Code:

```shell
claude mcp add nx-mcp npx nx-mcp@latest
```

## Powerful Use Cases

### Understanding Your Workspace Architecture

{% youtube src="https://youtu.be/RNilYmJJzdk" title="Nx Just Made Your LLM Way Smarter" /%}

Ask your AI assistant about your workspace structure and get detailed, accurate responses about projects, their types, and relationships:

```
What is the structure of this workspace?
How are the projects organized?
```

With Nx MCP, your AI assistant can:

- Identify applications and libraries in your workspace
- Understand project categorization through tags
- Recognize technology types (feature, UI, data-access)
- Determine project ownership and team responsibilities

![Example of LLM understanding project structure](/blog/images/articles/nx-ai-example-project-data.avif)

You can also get informed suggestions about where to implement new functionality:

```
Where should I implement a feature for adding products to cart?
```

![Example of LLM providing implementation guidance](/blog/images/articles/nx-ai-example-data-access-feature.avif)

Learn more about workspace architecture understanding in our blog post [Nx Just Made Your LLM Way Smarter](/blog/nx-just-made-your-llm-smarter).

### Instant CI Failure Resolution

{% youtube src="https://youtu.be/fPqPh4h8RJg" title="Connect Your Editor, CI and LLMs" /%}

When a CI build fails, Nx Console can notify you directly in your editor:

![Nx Console shows the notification of the CI failure](/blog/images/articles/ci-notification.avif)

Your AI assistant can then:

1. Access detailed information from Nx Cloud about the failed build
2. Analyze your git history to understand what changed in your PR
3. Understand the error context and affected files
4. Help implement the fix right in your editor

This integration dramatically improves the development velocity because you get immediately notified when an error occurs, you don't even have to leave your editor to understand what broke, and the LLM can help you implement or suggest a possible fix.

Learn more about CI integration in our blog post [Save Time: Connecting Your Editor, CI and LLMs](/blog/nx-editor-ci-llm-integration).

### Smart Code Generation with AI-Enhanced Generators

{% youtube src="https://youtu.be/PXNjedYhZDs" title="Enhancing Nx Generators with AI" /%}

Nx generators provide predictable code scaffolding, while AI adds intelligence and contextual understanding. Instead of having the AI generate everything from scratch, you get the best of both worlds:

```
Create a new React library into the packages/orders/feat-cancel-orders folder
and call the library with the same name of the folder structure. Afterwards,
also connect it to the main shop application.
```

Your AI assistant will:

1. Identify the appropriate generator and its parameters
2. Open the Nx Console Generate UI with preset values
3. Let you review and customize the options
4. Execute the generator and help integrate the new code with your existing projects

![LLM invoking the Nx generate UI](/blog/images/articles/llm-nx-generate-ui.avif)

This approach ensures consistent code that follows your organization's best practices while still being tailored to your specific needs. Learn more about AI-enhanced generators in our blog post [Enhancing Nx Generators with AI](/blog/nx-generators-ai-integration).

### Documentation-Aware Configuration

{% youtube src="https://youtu.be/V2W94Sq_v6A?si=aBA-eppEw0fHrh5O&t=388" title="Making Cursor Smarter with an MCP Server" /%}

Get accurate guidance on Nx configuration without worrying about hallucinations or outdated information:

```
Can you configure Nx release for the packages of this workspace?
Update nx.json with the necessary configuration using conventional commits
as the versioning strategy.
```

The AI assistant will:

1. Query the Nx docs for the latest information on release configuration
2. Understand your workspace structure to identify packages
3. Generate the correct configuration based on your specific needs
4. Apply the changes to your nx.json file

Learn more about documentation-aware configuration in our blog post [Making Cursor Smarter with an MCP Server For Nx Monorepos](/blog/nx-made-cursor-smarter).

### Cross-Project Dependency Analysis

{% youtube src="https://youtu.be/dRQq_B1HSLA?si=lhHsjRvwgijC1IL8&t=186" title="Nx MCP Now Available for VS Code Copilot" /%}

Understand the impact of changes across your monorepo with questions like:

```
If I change the public API of feat-product-detail, which other projects
might be affected by that change?
```

Your AI assistant can:

- Analyze the project graph to identify direct and indirect dependencies
- Visualize affected projects using the `nx_visualize_graph` tool
- Suggest strategies for refactoring that minimize impact
- Identify which teams would need to be consulted for major changes

This architectural awareness is particularly powerful in larger monorepos where understanding project relationships is crucial for making informed development decisions.

Learn more about dependency analysis in our blog post [Nx MCP Now Available for VS Code Copilot](/blog/nx-mcp-vscode-copilot).
