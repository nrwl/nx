import { extractDocumentedVars, extractUsedVarsFromContent } from './index';

describe('env-vars-documented', () => {
  describe('extractDocumentedVars()', () => {
    it('extracts NX_* names from table rows', () => {
      const mdoc = [
        '## Nx environment variables',
        '',
        '| Property                 | Type    | Description       |',
        '| ------------------------ | ------- | ----------------- |',
        '| `NX_BAIL`                | boolean | Stop on failure.  |',
        '| `NX_DAEMON`              | boolean | Disable daemon.   |',
        '| `SOMETHING_ELSE`         | string  | Not an Nx var.    |',
        '',
      ].join('\n');

      const result = extractDocumentedVars(mdoc);

      expect(Array.from(result).sort()).toEqual(['NX_BAIL', 'NX_DAEMON']);
    });

    it('ignores NX_* mentions in prose and descriptions', () => {
      const mdoc = [
        'Setting `NX_PROSE_ONLY` in your shell will not be detected here.',
        '| `NX_REAL_ENTRY` | boolean | Some `NX_INLINE_CODE` in the description. |',
      ].join('\n');

      const result = extractDocumentedVars(mdoc);

      expect(Array.from(result)).toEqual(['NX_REAL_ENTRY']);
    });
  });

  describe('extractUsedVarsFromContent()', () => {
    it('finds NX_* vars via process.env.X access', () => {
      const source = `
        if (process.env.NX_BAIL === 'true') return;
        const token = process.env.NX_CLOUD_ACCESS_TOKEN;
      `;
      expect(extractUsedVarsFromContent(source, 'foo.ts').sort()).toEqual([
        'NX_BAIL',
        'NX_CLOUD_ACCESS_TOKEN',
      ]);
    });

    it('finds NX_* vars via process.env["X"] and [\'X\'] access', () => {
      const source = `
        process.env["NX_DOUBLE_QUOTED"];
        process.env['NX_SINGLE_QUOTED'];
        process.env[\`NX_TEMPLATE_LITERAL\`];
      `;
      expect(extractUsedVarsFromContent(source, 'foo.ts').sort()).toEqual([
        'NX_DOUBLE_QUOTED',
        'NX_SINGLE_QUOTED',
        'NX_TEMPLATE_LITERAL',
      ]);
    });

    it('does not match string literals outside of process.env access', () => {
      const source = `
        const msg = "set NX_FAKE to true";
        const other = 'NX_ALSO_FAKE';
      `;
      expect(extractUsedVarsFromContent(source, 'foo.ts')).toEqual([]);
    });

    it('finds NX_* vars in Rust via env::var and std::env::var', () => {
      const source = `
        let a = env::var("NX_FIRST");
        let b = std::env::var("NX_SECOND").unwrap_or_default();
        let c = env::var_os("NX_THIRD");
      `;
      expect(extractUsedVarsFromContent(source, 'foo.rs').sort()).toEqual([
        'NX_FIRST',
        'NX_SECOND',
        'NX_THIRD',
      ]);
    });

    it('does not flag Rust env! macro usage (compile-time)', () => {
      const source = `let build_tag = env!("NX_BUILD_TAG");`;
      expect(extractUsedVarsFromContent(source, 'foo.rs')).toEqual([]);
    });

    it('finds NX_* vars in Rust via EnvFilter::(try_)?from_env', () => {
      const source = `
        EnvFilter::try_from_env("NX_TRY_FROM_ENV");
        EnvFilter::from_env("NX_FROM_ENV");
      `;
      expect(extractUsedVarsFromContent(source, 'foo.rs').sort()).toEqual([
        'NX_FROM_ENV',
        'NX_TRY_FROM_ENV',
      ]);
    });

    it('returns duplicates when the same var is read more than once', () => {
      const source = `
        process.env.NX_VERBOSE_LOGGING;
        if (process.env.NX_VERBOSE_LOGGING === 'true') {}
      `;
      expect(extractUsedVarsFromContent(source, 'foo.ts')).toEqual([
        'NX_VERBOSE_LOGGING',
        'NX_VERBOSE_LOGGING',
      ]);
    });
  });
});
