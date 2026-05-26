import 'nx/src/internal-testing-utils/mock-fs';
import { vol } from 'memfs';
import { PromptResolutionError, resolvePrompt } from './prompt-files';

describe('resolvePrompt', () => {
  beforeEach(() => {
    vol.reset();
  });

  it('should resolve a prompt file relative to the migrations directory', () => {
    vol.fromJSON({
      '/root/migrations/prompts/upgrade.md': '# Upgrade',
    });

    expect(resolvePrompt('prompts/upgrade.md', '/root/migrations')).toBe(
      '/root/migrations/prompts/upgrade.md'
    );
  });

  it('should throw when the prompt file does not exist', () => {
    vol.fromJSON({ '/root/migrations/migrations.json': '{}' });

    expect(() =>
      resolvePrompt('prompts/missing.md', '/root/migrations')
    ).toThrow(PromptResolutionError);
  });

  it('should throw when the prompt path escapes the migrations directory', () => {
    vol.fromJSON({ '/root/secret.md': '# Secret' });

    expect(() => resolvePrompt('../secret.md', '/root/migrations')).toThrow(
      PromptResolutionError
    );
  });

  it('should throw when the prompt path is absolute', () => {
    vol.fromJSON({ '/root/migrations/prompts/upgrade.md': '# Upgrade' });

    expect(() =>
      resolvePrompt('/root/migrations/prompts/upgrade.md', '/root/migrations')
    ).toThrow(PromptResolutionError);
  });
});
