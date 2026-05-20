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
  handoffFileAbsolutePath: '/abs/workspace/.nx/agentic/21.1.0/step-id.json',
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
  it('frames the agent as a validator (not an applier) in the lead sentence', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toMatch(
      /You are validating the output of an Nx migration's deterministic generator phase/
    );
  });

  it('always includes the migration metadata block', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toMatch(
      /<migration>[\s\S]*package: @nx\/react[\s\S]*<\/migration>/
    );
    expect(out).toContain('version: 21.1.0');
    expect(out).toContain('name: 21-1-0-rewrite-config');
    expect(out).toContain('description: Rewrite the react config file format');
  });

  it('always includes the handoff path', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toContain(
      `<handoff_path>${baseCtx.handoffFileAbsolutePath}</handoff_path>`
    );
  });

  it('does NOT emit an instructions_file or precedence block', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).not.toContain('<instructions_file>');
    expect(out).not.toContain('<precedence>');
  });

  it('emits inline validation_instructions', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toContain('<validation_instructions>');
    expect(out).toContain('</validation_instructions>');
  });

  it('instructs target discovery via nx show project rather than hardcoded names', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toMatch(/nx show project/);
    expect(out).toMatch(/do not assume `typecheck` \/ `test` \/ `lint` exist/i);
    expect(out).toMatch(/`build` is an acceptable substitute/);
  });

  it('permits nx affected, per-project nx run, and scoped nx run-many with -p', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toMatch(/nx affected -t/);
    expect(out).toMatch(/nx run <project>:<target>/);
    expect(out).toMatch(
      /nx run-many -t <target> -p <project1>,<project2>.*derived from the changed files/s
    );
  });

  it('forbids unscoped nx run-many', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toMatch(/Unscoped `nx run-many` \(no `-p`\) is forbidden/);
  });

  it('binds fixes to the migration intention, not the generator footprint', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toMatch(/what this migration intended to accomplish/);
    expect(out).toMatch(
      /do not refactor, do not modify functionality unrelated/i
    );
  });

  it('directs fix-what-you-can then write a failed handoff for unresolved findings', () => {
    const out = buildGenericValidationUserPrompt(baseCtx);
    expect(out).toMatch(
      /Apply every fix you can within scope.*write your handoff/s
    );
    expect(out).toMatch(/no commit will be created from a failed run/);
  });

  describe('<files_changed> rendering', () => {
    it('renders entries verbatim and includes the git diff hint when hasDiffContext is true', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: {
          ...baseCtx.impl,
          changes: [
            change('UPDATE', 'apps/foo/project.json'),
            change('CREATE', 'apps/foo/src/new.ts'),
            change('DELETE', 'apps/foo/src/old.ts'),
          ],
          hasDiffContext: true,
        },
      });
      expect(out).toContain('<files_changed');
      expect(out).toContain('[UPDATE] apps/foo/project.json');
      expect(out).toContain('[CREATE] apps/foo/src/new.ts');
      expect(out).toContain('[DELETE] apps/foo/src/old.ts');
      expect(out).toContain('git diff');
      expect(out).toContain('</files_changed>');
    });

    it('still renders the file list when hasDiffContext is false (without the git diff hint)', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: {
          ...baseCtx.impl,
          changes: [change('UPDATE', 'apps/foo/project.json')],
          hasDiffContext: false,
        },
      });
      expect(out).toContain('<files_changed');
      expect(out).toContain('[UPDATE] apps/foo/project.json');
      // Diff hint omitted.
      expect(out).not.toContain('git diff');
    });

    it('omits the files_changed block entirely when changes are empty', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: {
          ...baseCtx.impl,
          changes: [],
        },
      });
      // Tag-form match — the substring `<files_changed` appears inside
      // <validation_instructions> prose ("Resolve each path in <files_changed>
      // to its owning Nx project") even when no block is rendered.
      expect(out).not.toMatch(/<files_changed[^>]*>[\s\S]*<\/files_changed>/);
    });

    it('renders all entries verbatim when count is at or below the cap', () => {
      const exactlyCap = Array.from(
        { length: GENERIC_VALIDATION_FILE_LIST_CAP },
        (_, i) => change('UPDATE', `apps/p${i}/file.ts`)
      );
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: { ...baseCtx.impl, changes: exactlyCap },
      });
      for (const entry of exactlyCap) {
        expect(out).toContain(`[UPDATE] ${entry.path}`);
      }
      expect(out).not.toMatch(/and \d+ more file/);
    });

    it('caps the file list and renders a project-keyed summary footer when count exceeds the cap', () => {
      const overCap: FileChange[] = [];
      for (let i = 0; i < 200; i++) {
        overCap.push(change('UPDATE', `packages/foo/src/f${i}.ts`));
      }
      for (let i = 0; i < 180; i++) {
        overCap.push(change('UPDATE', `packages/bar/src/f${i}.ts`));
      }
      for (let i = 0; i < 43; i++) {
        overCap.push(change('UPDATE', `packages/baz/src/f${i}.ts`));
      }
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: { ...baseCtx.impl, changes: overCap },
      });

      // First N entries verbatim
      expect(out).toContain('[UPDATE] packages/foo/src/f0.ts');
      // Past the cap, project summary kicks in
      const remainder = overCap.length - GENERIC_VALIDATION_FILE_LIST_CAP;
      expect(out).toContain(`… and ${remainder} more files across 3 projects:`);
      // Summary lists projects with counts. The first-N range eats some
      // entries from packages/foo, leaving the remainder roughly:
      //   packages/foo: 200 - 50 = 150
      //   packages/bar: 180
      //   packages/baz: 43
      // Sorted by count desc: bar, foo, baz.
      expect(out).toMatch(/packages\/bar \(180\)/);
      expect(out).toMatch(/packages\/foo \(150\)/);
      expect(out).toMatch(/packages\/baz \(43\)/);
    });

    it('uses singular forms in the footer when only one extra file or one extra project remains', () => {
      const overCap: FileChange[] = Array.from(
        { length: GENERIC_VALIDATION_FILE_LIST_CAP + 1 },
        (_, i) => change('UPDATE', `apps/only/f${i}.ts`)
      );
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: { ...baseCtx.impl, changes: overCap },
      });
      expect(out).toMatch(/… and 1 more file across 1 project:/);
    });

    it('falls back to the top-level segment when a path does not start with a conventional Nx prefix', () => {
      const overCap: FileChange[] = [];
      // First fill the cap so the summary appears.
      for (let i = 0; i < GENERIC_VALIDATION_FILE_LIST_CAP; i++) {
        overCap.push(change('UPDATE', `apps/foo/src/f${i}.ts`));
      }
      // Then add 5 files under a non-Nx-conventional directory so they land
      // in the summary.
      for (let i = 0; i < 5; i++) {
        overCap.push(change('UPDATE', `custom-dir/sub/f${i}.ts`));
      }
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: { ...baseCtx.impl, changes: overCap },
      });
      expect(out).toMatch(/custom-dir \(5\)/);
    });
  });

  describe('<generator_output> rendering', () => {
    it('renders the logs section inside a fenced block when logs are provided, ANSI-stripped', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: {
          ...baseCtx.impl,
          logs: '\x1b[1m\x1b[33mbold-yellow\x1b[0m\nplain line',
        },
      });
      expect(out).toContain('<generator_output');
      expect(out).toContain('```\nbold-yellow\nplain line\n```');
      expect(out).toContain('</generator_output>');
      expect(out).not.toMatch(/\x1b\[/);
    });

    it('omits the logs section when logs are blank or whitespace-only', () => {
      expect(
        buildGenericValidationUserPrompt({
          ...baseCtx,
          impl: { ...baseCtx.impl, logs: '' },
        })
      ).not.toContain('<generator_output');
      expect(
        buildGenericValidationUserPrompt({
          ...baseCtx,
          impl: { ...baseCtx.impl, logs: '   \n\n' },
        })
      ).not.toContain('<generator_output');
    });
  });

  describe('<advisory_context> rendering', () => {
    it('renders agentContext as advisory bullets', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: {
          ...baseCtx.impl,
          agentContext: [
            'Consumer X may need manual update',
            'Adapter Y left untouched',
          ],
        },
      });
      expect(out).toContain('<advisory_context');
      expect(out).toContain('- Consumer X may need manual update');
      expect(out).toContain('- Adapter Y left untouched');
      expect(out).toContain('</advisory_context>');
    });

    it('uses a "supplementary context" framing in the note attribute', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: {
          ...baseCtx.impl,
          agentContext: ['hint'],
        },
      });
      expect(out).toContain('supplementary context');
      expect(out).not.toContain('consult while applying');
    });

    it('omits the advisory_context block when agentContext is empty or absent', () => {
      expect(
        buildGenericValidationUserPrompt({
          ...baseCtx,
          impl: { ...baseCtx.impl, agentContext: [] },
        })
      ).not.toContain('<advisory_context');
      expect(
        buildGenericValidationUserPrompt({
          ...baseCtx,
          impl: { ...baseCtx.impl, agentContext: undefined },
        })
      ).not.toContain('<advisory_context');
    });

    it('drops empty / non-string agentContext entries', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        impl: {
          ...baseCtx.impl,
          agentContext: ['', 'valid', '   ', null as any],
        },
      });
      expect(out).toContain('- valid');
      expect(out).not.toMatch(/^- $/m);
    });
  });

  describe('description rendering', () => {
    it('omits the description line when none is provided', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        description: undefined,
      });
      expect(out).not.toContain('description:');
    });

    it('renders a multi-line description as a YAML-style block scalar', () => {
      const out = buildGenericValidationUserPrompt({
        ...baseCtx,
        description: 'Line one\nLine two\nLine three',
      });
      expect(out).toContain('description: |');
      expect(out).toContain('  Line one');
      expect(out).toContain('  Line two');
      expect(out).toContain('  Line three');
    });
  });
});
