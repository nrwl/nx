import { NX_TIPS } from './catalog';
import {
  TipsState,
  applyTipContext,
  formatTip,
  selectTip,
  shouldShowTip,
} from './tips';

const CONNECTED_CTX = {
  isCloudConnected: true,
  isCloudOptedOut: false,
  isCI: false,
  isInteractive: true,
};
const DISCONNECTED_CTX = { ...CONNECTED_CTX, isCloudConnected: false };

const ENABLED_STATE: TipsState = { disabled: false };

describe('shouldShowTip', () => {
  it('true when enabled + interactive + not CI', () => {
    expect(shouldShowTip(CONNECTED_CTX, ENABLED_STATE)).toBe(true);
  });

  it('false when disabled', () => {
    expect(shouldShowTip(CONNECTED_CTX, { disabled: true })).toBe(false);
  });

  it('false in CI', () => {
    expect(shouldShowTip({ ...CONNECTED_CTX, isCI: true }, ENABLED_STATE)).toBe(
      false
    );
  });

  it('false when non-interactive (no TTY)', () => {
    expect(
      shouldShowTip({ ...CONNECTED_CTX, isInteractive: false }, ENABLED_STATE)
    ).toBe(false);
  });
});

describe('selectTip', () => {
  it('returns a tip', () => {
    expect(selectTip(CONNECTED_CTX)).toBeDefined();
  });

  it('never returns connect-only tips when already connected', () => {
    const connectOnlyIds = NX_TIPS.filter(
      (t) => t.appliesWhen && !t.appliesWhen(CONNECTED_CTX)
    ).map((t) => t.id);

    for (let i = 0; i < 50; i++) {
      expect(connectOnlyIds).not.toContain(selectTip(CONNECTED_CTX)?.id);
    }
  });

  it('can return the cloud tip when disconnected', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(selectTip(DISCONNECTED_CTX)!.id);
    expect(ids.has('remote-cache')).toBe(true);
  });

  it('never returns the cloud tip when the user opted out', () => {
    const optedOut = { ...DISCONNECTED_CTX, isCloudOptedOut: true };
    for (let i = 0; i < 50; i++) {
      expect(selectTip(optedOut)?.id).not.toBe('remote-cache');
    }
  });

  it('never returns a {project} tip without a sampleProject', () => {
    for (let i = 0; i < 50; i++) {
      const tip = selectTip(DISCONNECTED_CTX)!;
      expect(tip.command).not.toContain('{project}');
    }
  });

  it('can return a {project} tip once a sampleProject is known', () => {
    const ctx = { ...CONNECTED_CTX, sampleProject: '@org/api' };
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) ids.add(selectTip(ctx)!.id);
    expect(ids.has('show-project')).toBe(true);
  });
});

describe('applyTipContext', () => {
  it('fills {target} with the run target', () => {
    expect(
      applyTipContext('nx affected -t {target=test}', {
        ...DISCONNECTED_CTX,
        runTargets: ['lint'],
      })
    ).toBe('nx affected -t lint');
  });

  it('falls back to the token default when no target ran', () => {
    expect(
      applyTipContext('nx affected -t {target=test}', DISCONNECTED_CTX)
    ).toBe('nx affected -t test');
    expect(
      applyTipContext('nx run-many -t {target=build}', DISCONNECTED_CTX)
    ).toBe('nx run-many -t build');
  });

  it('fills {project} with a real project from the run', () => {
    expect(
      applyTipContext('nx show project {project}', {
        ...CONNECTED_CTX,
        sampleProject: '@org/api',
      })
    ).toBe('nx show project @org/api');
  });

  it('leaves commands without placeholders untouched', () => {
    expect(applyTipContext('npx nx connect', CONNECTED_CTX)).toBe(
      'npx nx connect'
    );
  });
});

describe('formatTip', () => {
  it('mutes the message and highlights the command CTA', () => {
    const tip = NX_TIPS.find((t) => t.id === 'affected')!;
    const rendered = formatTip(tip, CONNECTED_CTX);
    expect(rendered).toContain(tip.text);
    expect(rendered).toContain('nx affected');
  });

  it('renders the cloud tip docs link with utm attribution (OSC 8)', () => {
    const prev = process.env.FORCE_HYPERLINK;
    process.env.FORCE_HYPERLINK = '1'; // force terminalLink to emit the tracked href
    try {
      const tip = NX_TIPS.find((t) => t.id === 'remote-cache')!;
      const rendered = formatTip(tip, DISCONNECTED_CTX);
      expect(rendered).toContain('npx nx connect');
      expect(rendered).toContain(
        'https://nx.dev/nx-cloud?utm_source=nx-cli&utm_medium=tips'
      );
    } finally {
      process.env.FORCE_HYPERLINK = prev;
    }
  });
});
