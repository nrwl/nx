import { withEnvironmentVariables } from '../internal-testing-utils/with-environment';
import { shouldUseTui } from './is-tui-enabled';

describe('shouldUseTui', () => {
  it('should return true by default', () =>
    withEnvironmentVariables(
      {
        NX_TUI: null,
        CI: 'false',
      },
      () => {
        // default  is false  in nx.json
        expect(shouldUseTui({}, {}, true)).toBe(false);
      }
    ));

  it('should return true if the TUI is enabled', () =>
    withEnvironmentVariables(
      {
        NX_TUI: 'true',
        CI: 'false',
      },
      () => {
        expect(shouldUseTui({}, {}, true)).toBe(true);
      }
    ));

  it('should return false if the TUI is disabled', () =>
    withEnvironmentVariables(
      {
        NX_TUI: 'false',
        CI: 'false',
      },
      () => {
        expect(shouldUseTui({}, {}, true)).toBe(false);
      }
    ));

  it('should return false in CI', () =>
    withEnvironmentVariables(
      {
        CI: 'true',
      },
      () => {
        expect(shouldUseTui({}, {}, true)).toBe(false);
      }
    ));

  it('should return true if TUI is enabled in CI', () =>
    withEnvironmentVariables(
      {
        NX_TUI: 'true',
        CI: 'true',
      },
      () => {
        expect(shouldUseTui({}, {}, true)).toBe(true);
      }
    ));

  it('should return true if the TUI is enabled in nx.json', () =>
    withEnvironmentVariables(
      {
        NX_TUI: null,
        CI: 'false',
      },
      () => {
        expect(shouldUseTui({ tui: { enabled: true } }, {}, true)).toBe(true);
      }
    ));

  it('should return false if the TUI is disabled in nx.json', () =>
    withEnvironmentVariables(
      {
        NX_TUI: null,
        CI: 'false',
      },
      () => {
        expect(shouldUseTui({ tui: { enabled: false } }, {}, true)).toBe(false);
      }
    ));

  it.each(['dynamic-legacy', 'static', 'stream'])(
    'should be disabled if output-style=%s',
    (outputStyle) =>
      withEnvironmentVariables(
        {
          NX_TUI: null,
          CI: 'false',
        },
        () => {
          expect(
            shouldUseTui({ tui: { enabled: true } }, { outputStyle }, true)
          ).toBe(false);
        }
      )
  );

  it.each(['dynamic', 'tui'])('should be enabled if output-style=%s', () =>
    withEnvironmentVariables(
      {
        NX_TUI: null,
        CI: 'false',
      },
      () => {
        expect(
          shouldUseTui(
            { tui: { enabled: true } },
            { outputStyle: 'dynamic' },
            true
          )
        ).toBe(true);
      }
    )
  );

  describe('priority', () => {
    it('should prioritize the CLI args over the env var', () =>
      withEnvironmentVariables(
        {
          NX_TUI: 'false',
          CI: 'false',
        },
        () => {
          expect(shouldUseTui({}, { outputStyle: 'dynamic' }, true)).toBe(true);
        }
      ));

    it('should prioritize the env var over the nx.json config', () =>
      withEnvironmentVariables(
        {
          NX_TUI: 'false',
          CI: 'false',
        },
        () => {
          expect(shouldUseTui({ tui: { enabled: true } }, {}, true)).toBe(
            false
          );
        }
      ));
  });
});
