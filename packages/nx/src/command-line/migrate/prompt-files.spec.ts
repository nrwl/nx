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

  it('should throw when the prompt file is not a markdown file', () => {
    vol.fromJSON({ '/root/migrations/prompts/project.json': '{}' });

    expect(() =>
      resolvePrompt('prompts/project.json', '/root/migrations')
    ).toThrow(PromptResolutionError);
  });

  it('should throw when the prompt file name has a character reserved on Windows', () => {
    vol.fromJSON({ '/root/migrations/prompts/project.json:x.md': '# Prompt' });

    expect(() =>
      resolvePrompt('prompts/project.json:x.md', '/root/migrations')
    ).toThrow(PromptResolutionError);
  });

  it('should throw when the prompt path escapes the migrations directory through a link', () => {
    vol.fromJSON({
      '/root/migrations/migrations.json': '{}',
      '/root/secret.md': '# Secret',
    });
    vol.symlinkSync('/root', '/root/migrations/linked');

    expect(() => resolvePrompt('linked/secret.md', '/root/migrations')).toThrow(
      PromptResolutionError
    );
  });

  it('should throw when the prompt path points into the node_modules of the package', () => {
    vol.fromJSON({
      '/root/migrations/node_modules/dep/upgrade.md': '# Upgrade',
    });

    expect(() =>
      resolvePrompt('node_modules/dep/upgrade.md', '/root/migrations')
    ).toThrow(PromptResolutionError);
  });

  it('should resolve a prompt file when the migrations directory is reached through a link', () => {
    vol.fromJSON({
      '/store/pkg/prompts/upgrade.md': '# Upgrade',
    });
    vol.mkdirSync('/root/node_modules', { recursive: true });
    vol.symlinkSync('/store/pkg', '/root/node_modules/pkg');

    expect(resolvePrompt('prompts/upgrade.md', '/root/node_modules/pkg')).toBe(
      '/root/node_modules/pkg/prompts/upgrade.md'
    );
  });
});
