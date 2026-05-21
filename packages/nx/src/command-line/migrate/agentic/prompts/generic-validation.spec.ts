import type { FileChange } from '../../../../generators/tree';
import {
  buildGenericValidationUserPrompt,
  GENERIC_VALIDATION_FILE_LIST_CAP,
  type GenericValidationPromptContext,
} from './generic-validation';

const baseCtx: GenericValidationPromptContext = {
  package: '@nx/react',
  name: '21-1-0-rewrite-config',
  version: '21.1.0',
  description: 'Rewrite the react config file format',
  handoffFileAbsolutePath:
    '/abs/workspace/.nx/migrate-runs/21.1.0/step-id.json',
  impl: {
    changes: [
      change('UPDATE', 'apps/foo/project.json'),
      change('CREATE', 'apps/foo/src/new.ts'),
    ],
    hasDiffContext: true,
  },
};

function change(type: FileChange['type'], path: string): FileChange {
  return { type, path, content: null };
}

describe('buildGenericValidationUserPrompt', () => {
  it('includes migration metadata, handoff path, and inline <validation_instructions> (no instructions_file or precedence)', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toMatch(
      /<migration>[\s\S]*package: @nx\/react[\s\S]*<\/migration>/
    );
    expect(out).toContain('name: 21-1-0-rewrite-config');
    expect(out).toContain(
      `<handoff_path>\n${baseCtx.handoffFileAbsolutePath}\n</handoff_path>`
    );
    expect(out).toContain('<validation_instructions>');
    expect(out).toContain('</validation_instructions>');
    // Structural delta vs hybrid: no external instructions file / precedence.
    expect(out).not.toContain('<instructions_file>');
    expect(out).not.toContain('<precedence>');
  });

  describe('files_changed / git-inspect rendering', () => {
    it('points the agent at git (no <files_changed>) when hasDiffContext is true', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: {
          ...baseCtx.impl,
          changes: [change('UPDATE', 'apps/foo/project.json')],
          hasDiffContext: true,
        },
      });
      expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
      expect(out).toMatch(/git status --porcelain=v1 -uall/);
    });

    it('embeds <files_changed> with no git hint when hasDiffContext is false', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: {
          ...baseCtx.impl,
          changes: [change('UPDATE', 'apps/foo/project.json')],
          hasDiffContext: false,
        },
      });
      expect(out).toMatch(/<files_changed>[\s\S]*<\/files_changed>/);
      expect(out).toContain('[UPDATE] apps/foo/project.json');
      expect(out).not.toMatch(/git status --porcelain/);
    });

    it('omits <files_changed> entirely when changes are empty and hasDiffContext is false', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: { ...baseCtx.impl, changes: [], hasDiffContext: false },
      });
      expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
    });

    it('renders all entries verbatim when count is at the cap', () => {
      const exactlyCap = Array.from(
        { length: GENERIC_VALIDATION_FILE_LIST_CAP },
        (_, i) => change('UPDATE', `apps/p${i}/file.ts`)
      );
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: { ...baseCtx.impl, changes: exactlyCap, hasDiffContext: false },
      });
      expect(out).toContain(`[UPDATE] ${exactlyCap[0].path}`);
      expect(out).toContain(
        `[UPDATE] ${exactlyCap[exactlyCap.length - 1].path}`
      );
      expect(out).not.toMatch(/and \d+ more file/);
    });

    it('caps the file list and appends "… and N more files." when count exceeds the cap', () => {
      const overCap: FileChange[] = Array.from(
        { length: GENERIC_VALIDATION_FILE_LIST_CAP + 5 },
        (_, i) => change('UPDATE', `packages/foo/src/f${i}.ts`)
      );
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: { ...baseCtx.impl, changes: overCap, hasDiffContext: false },
      });
      expect(out).toContain('[UPDATE] packages/foo/src/f0.ts');
      expect(out).toContain('… and 5 more files.');
    });

    it('uses singular "file" when exactly one extra remains', () => {
      const overCap: FileChange[] = Array.from(
        { length: GENERIC_VALIDATION_FILE_LIST_CAP + 1 },
        (_, i) => change('UPDATE', `apps/only/f${i}.ts`)
      );
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: { ...baseCtx.impl, changes: overCap, hasDiffContext: false },
      });
      expect(out).toMatch(/… and 1 more file\./);
    });
  });
});
