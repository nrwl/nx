// Keep in sync with packages/nx/src/utils/terminal-link.ts.
// create-nx-workspace cannot depend on nx, so this generic OSC 8 helper is
// intentionally duplicated (same reasoning as output.ts / package-manager.ts).

const OSC = '\u001B]';
const BEL = '\u0007';
const SEP = ';';

/**
 * Wrap `text` in an OSC 8 hyperlink that points at `url`. Supported terminals
 * render `text` as a clickable link to `url`; everywhere else `text` prints
 * unchanged. This lets us keep tracking querystrings out of the visible output
 * while still attaching them to the link target (CLOUD-4642).
 */
export function terminalLink(text: string, url: string): string {
  if (!supportsHyperlinks()) {
    return text;
  }
  return [OSC, '8', SEP, SEP, url, BEL, text, OSC, '8', SEP, SEP, BEL].join('');
}

/**
 * Best-effort detection of OSC 8 hyperlink support, adapted from the
 * `supports-hyperlinks` package. Defaults to false when in doubt so we never
 * print raw escape sequences to a terminal that can't render them.
 */
function supportsHyperlinks(): boolean {
  const env = process.env;

  if (env.FORCE_HYPERLINK !== undefined) {
    return !(
      env.FORCE_HYPERLINK.length > 0 && parseInt(env.FORCE_HYPERLINK, 10) === 0
    );
  }

  if (!process.stdout || !process.stdout.isTTY) {
    return false;
  }

  if (process.platform === 'win32') {
    // Only Windows Terminal advertises OSC 8 support reliably.
    return Boolean(env.WT_SESSION);
  }

  if (env.CI || env.TEAMCITY_VERSION) {
    return false;
  }
  if (env.TERM === 'dumb') {
    return false;
  }

  if (env.TERM_PROGRAM) {
    const version = parseVersion(env.TERM_PROGRAM_VERSION);
    switch (env.TERM_PROGRAM) {
      case 'iTerm.app':
        return version.major === 3 ? version.minor >= 1 : version.major > 3;
      case 'WezTerm':
        return version.major >= 20200620;
      case 'vscode':
        return (
          version.major > 1 || (version.major === 1 && version.minor >= 72)
        );
      case 'ghostty':
        return true;
    }
  }

  if (env.VTE_VERSION) {
    if (env.VTE_VERSION === '0.50.0') {
      return false;
    }
    const version = parseVersion(env.VTE_VERSION);
    return version.major > 0 || version.minor >= 50;
  }

  if (env.TERM === 'xterm-kitty') {
    return true;
  }
  if (env.TERMINAL_EMULATOR === 'JetBrains-JediTerm') {
    return true;
  }

  return false;
}

/**
 * Exported for testing. VTE reports versions as a packed integer, e.g. "5402"
 * means 0.54.2; everything else is dot-separated.
 */
export function parseVersion(versionString = ''): {
  major: number;
  minor: number;
  patch: number;
} {
  if (/^\d{3,4}$/.test(versionString)) {
    const m = /(\d{1,2})(\d{2})/.exec(versionString) ?? [];
    return { major: 0, minor: parseInt(m[1], 10), patch: parseInt(m[2], 10) };
  }
  const [major = 0, minor = 0, patch = 0] = (versionString ?? '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  return { major, minor, patch };
}
