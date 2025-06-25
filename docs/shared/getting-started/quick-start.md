---
title: Quickstart with Nx
description: Get up and running with Nx in minutes - install Nx, set up your editor, configure AI assistance, and choose your development path.
---

# Getting Started

Get up and running with Nx in just a few minutes by following these simple steps.

{% steps %}

{% step title="Install Nx" %}

To install Nx on your machine, choose one of the following methods based on your operating system and package manager. You can also use `npx` to run Nx without installing it globally.

{% tabs %}
{% tab label="npm" %}

```shell
npm add --global nx
```

**Note:** You can also use Yarn, pnpm, or Bun

{% /tab %}
{% tab label="Homebrew (macOS, Linux)" %}

```shell
brew install nx
```

{% /tab %}
{% tab label="Chocolatey (Windows)" %}

```shell
choco install nx
```

{% /tab %}
{% tab label="apt (Ubuntu)" %}

```shell
sudo add-apt-repository ppa:nrwl/nx
sudo apt update
sudo apt install nx
```

{% /tab %}
{% /tabs %}

**Having installation issues?** If you encounter problems with global installations, see our [troubleshooting guide](/installation/troubleshoot-installation#global-installation-issues).

{% /step %}

{% step title="Set Up Your Editor" %}

Nx Console is an editor extension that integrates Nx seamlessly into your development workflow with project details views, visual migration UI, command palette integration, and CI pipeline notifications.

{% install-nx-console /%}

{% /step %}

{% step title="Configure Your AI Assistant" %}

Nx Console automatically configures and exposes the Nx MCP server. You'll receive a notification to "Improve Copilot/AI agent with Nx-specific context" - click "Yes" to automatically configure it.

![VS Code showing the Nx MCP installation prompt](/blog/images/articles/copilot-mcp-install.avif)

If you miss the notification, run `nx.configureMcpServer` from the command palette (`Ctrl/Cmd + Shift + P`).

For other MCP-compatible clients like Claude Desktop:

```json {% fileName="mcp.json" %}
{
  "servers": {
    "nx-mcp": {
      "command": "npx",
      "args": ["nx-mcp@latest", "/path/to/your/workspace"]
    }
  }
}
```

Replace `/path/to/your/workspace` with your workspace path. Learn more about how Nx improves [your AI assistant](/features/enhance-AI).

{% /step %}

{% step title="Choose Your Path" %}

Now that you have Nx installed and your development environment configured, choose how you want to proceed:

{% cards %}

{% card title="Create a New Project" description="Start fresh with a new Nx workspace using your preferred technology stack" type="documentation" url="/getting-started/start-new-project" /%}

{% card title="Add to Existing Project" description="Integrate Nx into your existing repository to leverage caching and speed up CI" type="documentation" url="/getting-started/adding-to-existing" /%}

{% card title="Follow a Tutorial" description="Learn Nx through hands-on tutorials for different technology stacks" type="documentation" url="/getting-started/tutorials" /%}

{% card title="Explore Nx Features" description="Discover all the powerful features that Nx offers" type="documentation" url="/features" /%}

{% /cards %}

{% /step %}

{% /steps %}
