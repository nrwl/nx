export function isSandbox(): boolean {
  return (
    !!process.env.SANDBOX_RUNTIME ||
    !!process.env.GEMINI_SANDBOX ||
    !!process.env.CODEX_SANDBOX ||
    // Codex only sets CODEX_SANDBOX on macOS; on Linux it sets this instead.
    !!process.env.CODEX_SANDBOX_NETWORK_DISABLED ||
    !!process.env.CURSOR_SANDBOX
  );
}
