import type { NxJsonConfiguration } from '../config/nx-json';
import { readNxJsonFromDisk } from '../devkit-internals';

let tuiEnabled = undefined;

export function isTuiEnabled(nxJson?: NxJsonConfiguration) {
  if (tuiEnabled !== undefined) {
    return tuiEnabled;
  }

  // If the current terminal/environment is not capable of displaying the TUI, we don't run it
  const isCapable = process.stderr.isTTY && isUnicodeSupported();
  if (!isCapable) {
    tuiEnabled = false;
    return tuiEnabled;
  }

  // The environment variable takes precedence over the nx.json config
  if (typeof process.env.NX_TUI === 'string') {
    tuiEnabled = process.env.NX_TUI === 'true' ? true : false;
    return tuiEnabled;
  }

  // Only read from disk if nx.json config is not already provided (and we have been able to determine tuiEnabled based on the above checks)
  if (!nxJson) {
    nxJson = readNxJsonFromDisk();
  }
  if (typeof nxJson.tui?.enabled === 'boolean') {
    tuiEnabled = Boolean(nxJson.tui?.enabled);
    // When the nx.json config is set, also set the environment variable for consistency and ease of checking on the rust side, for example
    process.env.NX_TUI = tuiEnabled.toString();
  } else {
    // False by default
    // TODO(v21): Change this to true by default
    tuiEnabled = false;
  }

  return tuiEnabled;
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
