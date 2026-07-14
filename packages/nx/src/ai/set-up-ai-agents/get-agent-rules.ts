import type { PackageManager } from '../../utils/package-manager';
import { getWorkspaceContext } from './workspace-context';

export interface AgentRulesOptions {
  nxCloud: boolean;
  useH1?: boolean;
  packageManager?: PackageManager;
}

/**
 * Claude's skills are installed from the plugin marketplace rather than copied through
 * `generateFiles`, so unlike every other agent they never pass through the workspace
 * render. This line is the one place nx can still state the package manager to Claude
 * directly, which is why it is worth stating rather than describing.
 */
function getNxInvocationRule(
  packageManager: PackageManager | undefined
): string {
  const { pm } = getWorkspaceContext(packageManager, '');
  if (!pm) {
    return `- Prefix nx commands with the workspace's package manager (e.g., \`pnpm nx build\`, \`npm exec nx test\`) - avoids using globally installed CLI`;
  }
  return `- This workspace uses ${pm.name}. Run nx as \`${pm.nx}\` (e.g. \`${pm.nx} build\`) - avoids using globally installed CLI`;
}

export function getAgentRules(options: AgentRulesOptions) {
  const { nxCloud, useH1 = true, packageManager } = options;
  const header = useH1 ? '#' : '##';
  return `${header} General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the \`nx-workspace\` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through \`nx\` (i.e. \`nx run\`, \`nx run-many\`, \`nx affected\`) instead of using the underlying tooling directly
${getNxInvocationRule(packageManager)}
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check \`node_modules/@nx/<plugin>/PLUGIN.md\`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or \`--help\` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the \`nx-generate\` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (\`nx g @nx/react:app\`), standard commands, things you already know
- The \`nx-generate\` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax
`;
}
