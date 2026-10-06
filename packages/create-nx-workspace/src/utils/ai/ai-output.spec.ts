import { buildErrorResult } from './ai-output';

describe('buildErrorResult hints', () => {
  it('NETWORK_ERROR points at network/sandbox config and the --preset=empty escape hatch', () => {
    const hints = buildErrorResult('boom', 'NETWORK_ERROR').hints.join('\n');
    expect(hints).toMatch(/sandbox configuration/);
    expect(hints).toMatch(/--preset=empty/);
  });

  it('TEMPLATE_CLONE_FAILED points at the template name and still offers the escape hatch', () => {
    const hints = buildErrorResult('boom', 'TEMPLATE_CLONE_FAILED').hints.join(
      '\n'
    );
    expect(hints).toMatch(/template name/);
    expect(hints).toMatch(/--preset=empty/);
  });

  it('unknown codes fall through to generic hints', () => {
    const hints = buildErrorResult('boom', 'UNKNOWN').hints.join('\n');
    expect(hints).toMatch(/github\.com\/nrwl\/nx\/issues/);
  });
});
