import { renderAgent } from './agent';
import { diagnostics } from './fixtures.spec-util';

describe('renderAgent', () => {
  it('should render one line per diagnostic the way Oxlint does', () => {
    expect(renderAgent(diagnostics)).toBe(
      "libs/a/src/x.ts:2:10: error eslint(no-unused-vars): Function 'f' is declared but never used. help: Consider removing this declaration.\n" +
        'libs/a/src/x.ts:1:1: warning eslint(no-console): Unexpected console statement. help: Delete this console statement.\n'
    );
  });

  it('should render nothing for a clean run', () => {
    expect(renderAgent([])).toBe('');
  });
});
