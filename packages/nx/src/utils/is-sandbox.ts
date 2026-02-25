export function isSandbox(): boolean {
  return (
    !!process.env.SANDBOX_RUNTIME ||
    !!process.env.GEMINI_SANDBOX ||
    !!process.env.CODEX_SANDBOX ||
    !!process.env.CURSOR_SANDBOX
  );
}
