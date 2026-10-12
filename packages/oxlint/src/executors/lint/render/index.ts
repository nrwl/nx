import type { OxlintDiagnostic } from '../run-oxlint.js';
import type { OxlintOutputFormat } from '../schema.js';
import { renderAgent } from './agent.js';
import { renderGraphical } from './default.js';
import { renderGithub } from './github.js';
import { summary, type RenderContext } from './shared.js';

export { countBySeverity } from './shared.js';

export function renderDiagnostics(
  format: OxlintOutputFormat,
  diagnostics: OxlintDiagnostic[],
  context: RenderContext
): string {
  switch (format) {
    case 'json':
      return JSON.stringify({ diagnostics }, null, 2) + '\n';
    case 'github':
      return (
        renderGithub(diagnostics, context.workspaceRoot) + summary(diagnostics)
      );
    case 'agent':
      return renderAgent(diagnostics);
    case 'default':
      return context.agentMode
        ? renderAgent(diagnostics)
        : renderGraphical(diagnostics, context.workspaceRoot) +
            summary(diagnostics);
  }
}
