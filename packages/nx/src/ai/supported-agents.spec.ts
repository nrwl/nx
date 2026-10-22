import { output } from '../utils/output';
import { filterSupportedAgents } from './utils';

describe('filterSupportedAgents', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(output, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('should keep supported agents without warning', () => {
    expect(filterSupportedAgents(['claude', 'codex'])).toEqual([
      'claude',
      'codex',
    ]);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should warn about and drop agents nx no longer supports', () => {
    expect(filterSupportedAgents(['copilot', 'cursor', 'gemini'])).toEqual([
      'cursor',
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title:
          'GitHub Copilot and Gemini are no longer supported by nx configure-ai-agents',
      })
    );
  });
});
