import type { OxlintDiagnostic } from '../run-oxlint.js';
import type { OxlintOutputFormat } from '../schema.js';
import { renderAgent } from './agent.js';
import { renderGraphical } from './default.js';
import { renderGithub } from './github.js';
import { renderJson } from './json.js';
import { summary, type RenderContext } from './shared.js';

export { countBySeverity, type RenderContext } from './shared.js';

export function renderDiagnostics(
  format: OxlintOutputFormat,
  diagnostics: OxlintDiagnostic[],
  context: RenderContext
): string {
  switch (format) {
    case 'json':
      return renderJson(diagnostics);
    case 'github':
      return renderGithub(diagnostics, context) + summary(diagnostics);
    case 'agent':
      return renderAgent(diagnostics);
    case 'default':
      return context.agentMode
        ? renderAgent(diagnostics)
        : renderGraphical(diagnostics, context) + summary(diagnostics);
  }
}
