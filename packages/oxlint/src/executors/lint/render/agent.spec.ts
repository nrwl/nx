import { renderAgent } from './agent';
import { filelessDiagnostic, multilineDiagnostic } from './fixtures.spec-util';

describe('renderAgent', () => {
  it('should render a diagnostic with no file or rule', () => {
    expect(renderAgent([filelessDiagnostic])).toBe(
      '<unknown>: error: There are suppressions that do not occur anymore. help: Run `oxlint --prune-suppressions` to remove unused suppressions.\n'
    );
  });

  it('should join the lines of a message and its help the way Oxlint does', () => {
    expect(renderAgent([multilineDiagnostic])).toBe(
      'libs/a/src/x.ts:1:1: error probe(multi): First line. Second line indented third. help: Check the first. Then the second.\n'
    );
  });
});
