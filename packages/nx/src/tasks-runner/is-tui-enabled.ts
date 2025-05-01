import type { NxJsonConfiguration } from '../config/nx-json';
import { IS_WASM } from '../native';
import { NxArgs } from '../utils/command-line-utils';
import { isCI } from '../utils/is-ci';

let tuiEnabled = undefined;

/**
 * @returns If tui is enabled
 */
export function isTuiEnabled() {
  return process.env.NX_TUI === 'true';
}

/**
 * Determines if the TUI should be enabled for the current environment.
 *
 * **Note:** This function should almost never be called directly. Instead, use the `isTuiEnabled` function.
 *
 * @param nxJson `nx.json`
 * @param nxArgs CLI Flags passed into Nx
 * @param skipCapabilityCheck Mainly used for unit tests.
 * @returns `true` if the TUI should be enabled, `false` otherwise.
 */
export function shouldUseTui(
  nxJson: NxJsonConfiguration,
  nxArgs: NxArgs,
  skipCapabilityCheck = process.env.NX_TUI_SKIP_CAPABILITY_CHECK === 'true'
) {
  // If the current terminal/environment is not capable of displaying the TUI, we don't run it
  const isWindows = process.platform === 'win32';
  const isCapable =
    skipCapabilityCheck || (process.stderr.isTTY && isUnicodeSupported());

  if (!isCapable) {
    return false;
  }

  // The environment variable takes precedence over the nx.json config
  if (typeof process.env.NX_TUI === 'string') {
    return process.env.NX_TUI === 'true';
  }

  if (['static', 'stream', 'dynamic-legacy'].includes(nxArgs.outputStyle)) {
    // If the user has specified a non-TUI output style, we disable the TUI
    return false;
  }

  if (
    // Interactive TUI doesn't make sense on CI
    isCI() ||
    // TODO(@JamesHenry): Remove this check once Windows issues are fixed.
    // Windows is not working well right now, temporarily disable it on Windows even if it has been specified as enabled
    isWindows ||
    // WASM needs further testing
    IS_WASM
  ) {
    return false;
  }

  if (nxArgs.outputStyle === 'dynamic' || nxArgs.outputStyle === 'tui') {
    return true;
  }

  // Respect user config
  if (typeof nxJson.tui?.enabled === 'boolean') {
    return Boolean(nxJson.tui?.enabled);
  }

  // Default to enabling the TUI if the system is capable of displaying it
  return true;
}

// Credit to https://github.com/sindresorhus/is-unicode-supported/blob/e0373335038856c63034c8eef6ac43ee3827a601/index.js
function isUnicodeSupported() {
  const { env } = process;
  const { TERM, TERM_PROGRAM } = env;
  if (process.platform !== 'win32') {
    return TERM !== 'linux'; // Linux console (kernel)
  }
  return (
    Boolean(env.WT_SESSION) || // Windows Terminal
    Boolean(env.TERMINUS_SUBLIME) || // Terminus (<0.2.27)
    env.ConEmuTask === '{cmd::Cmder}' || // ConEmu and cmder
    TERM_PROGRAM === 'Terminus-Sublime' ||
    TERM_PROGRAM === 'vscode' ||
    TERM === 'xterm-256color' ||
    TERM === 'alacritty' ||
    TERM === 'rxvt-unicode' ||
    TERM === 'rxvt-unicode-256color' ||
    env.TERMINAL_EMULATOR === 'JetBrains-JediTerm'
  );
}
