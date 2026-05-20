import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt', () => {
  const ctx = {
    workspaceRoot: '/abs/workspace',
    handoffFileAbsolutePath: '/abs/workspace/.nx/agentic/23.0.0/step-1.json',
  };

  it('embeds the workspace root inside a workspace_root tag', () => {
    expect(buildSystemPrompt(ctx)).toContain(
      '<workspace_root>/abs/workspace</workspace_root>'
    );
  });

  it('embeds the absolute handoff file path inside a handoff_path tag', () => {
    expect(buildSystemPrompt(ctx)).toContain(
      '<handoff_path>/abs/workspace/.nx/agentic/23.0.0/step-1.json</handoff_path>'
    );
  });

  it('wraps the handoff contract in a handoff_contract tag', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('<handoff_contract>');
    expect(prompt).toContain('</handoff_contract>');
  });

  it('declares the handoff status values', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('"success"');
    expect(prompt).toContain('"failed"');
  });

  it('mentions the ambiguous outcome when the handoff file is missing', () => {
    expect(buildSystemPrompt(ctx)).toMatch(/ambiguous/i);
  });

  it('states that extra handoff fields are ignored', () => {
    expect(buildSystemPrompt(ctx)).toMatch(/extra fields .*ignored/i);
  });

  it('locks the handoff path and shape against instructions-file overrides', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toMatch(/cannot be overridden/i);
    expect(prompt).toMatch(/follow this contract/i);
  });

  it('declares the handoff parent directory already exists', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toMatch(/parent directory already exists/i);
    expect(prompt).toMatch(/do not run `mkdir`/i);
  });

  it('wraps the scope rules in a scope_rules tag', () => {
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('<scope_rules>');
    expect(prompt).toContain('</scope_rules>');
  });

  describe('author mode (default)', () => {
    it('warns against changes outside the migration scope', () => {
      expect(buildSystemPrompt(ctx)).toMatch(/refactor|reformat|dependencies/i);
    });

    it('forbids running other mutating nx commands', () => {
      expect(buildSystemPrompt(ctx)).toMatch(/nx (migrate|reset|run-many)/);
    });

    it('tells the agent to fail rather than guess on unclear instructions', () => {
      expect(buildSystemPrompt(ctx)).toMatch(/unclear/i);
      expect(buildSystemPrompt(ctx)).toMatch(/do not guess/i);
    });

    it('emits the author scope rules when mode is omitted', () => {
      expect(buildSystemPrompt(ctx)).toContain(
        'Apply only the changes the migration prompt asks for.'
      );
    });

    it('emits the author scope rules when mode is set to "author" explicitly', () => {
      expect(buildSystemPrompt({ ...ctx, mode: 'author' })).toContain(
        'Apply only the changes the migration prompt asks for.'
      );
    });
  });

  describe('generic-validation mode', () => {
    const validationCtx = { ...ctx, mode: 'generic-validation' as const };

    it('frames the agent as a validator of generator output', () => {
      expect(buildSystemPrompt(validationCtx)).toMatch(
        /validate the generator's changes/i
      );
    });

    it('instructs target discovery via nx show project rather than hardcoded names', () => {
      const prompt = buildSystemPrompt(validationCtx);
      expect(prompt).toMatch(/nx show project/);
      expect(prompt).toMatch(/Do not assume specific target names/);
    });

    it('permits nx affected and per-project nx run', () => {
      const prompt = buildSystemPrompt(validationCtx);
      expect(prompt).toMatch(/nx affected -t/);
      expect(prompt).toMatch(/nx run <project>:<target>/);
    });

    it('permits scoped nx run-many with -p but forbids unscoped run-many', () => {
      const prompt = buildSystemPrompt(validationCtx);
      expect(prompt).toMatch(
        /nx run-many -t <target> -p <project1>,<project2>/
      );
      expect(prompt).toMatch(/Unscoped `nx run-many` \(no `-p`\) is forbidden/);
    });

    it('permits artifact-writing inspection commands', () => {
      const prompt = buildSystemPrompt(validationCtx);
      expect(prompt).toMatch(/nx graph --file/);
      expect(prompt).toMatch(/do not mutate workspace source/i);
    });

    it('binds fixes to the migration intention, not the generator footprint', () => {
      const prompt = buildSystemPrompt(validationCtx);
      expect(prompt).toMatch(/this migration intended to accomplish/i);
      expect(prompt).toMatch(
        /Do not refactor, do not modify unrelated functionality/
      );
    });

    it('forbids other mutating nx commands', () => {
      const prompt = buildSystemPrompt(validationCtx);
      expect(prompt).toMatch(/Do not run other `nx` commands that mutate/);
      expect(prompt).toMatch(/nx migrate.*nx reset.*generators/s);
    });

    it('forbids modifying files outside the workspace root', () => {
      expect(buildSystemPrompt(validationCtx)).toMatch(
        /Do not modify files outside the workspace root/
      );
    });

    it('directs fix-what-you-can-then-fail on unresolved findings', () => {
      const prompt = buildSystemPrompt(validationCtx);
      expect(prompt).toMatch(
        /apply every fix you can within scope.*then exit with `status: "failed"`/s
      );
      expect(prompt).toMatch(/Do not guess/);
    });

    it('does not emit the author-mode scope rules', () => {
      const prompt = buildSystemPrompt(validationCtx);
      expect(prompt).not.toContain(
        'Apply only the changes the migration prompt asks for.'
      );
    });
  });
});
