// Shared time constants. The window UNIT differs per PM (npm: days, pnpm/yarn:
// minutes, bun: seconds); each reader converts its value to ms using these.
export const MS_PER_SECOND = 1_000;
export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;
