export const TUI_ENABLED =
  process.env.NX_TUI === 'true' && process.stdout.isTTY;
