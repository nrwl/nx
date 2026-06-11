/**
 * Prompts user for analytics preference if not already set in nx.json.
 * Only prompts in interactive terminals, not in CI.
 */
export declare function ensureAnalyticsPreferenceSet(): Promise<void>;
export declare function promptForAnalyticsPreference(): Promise<boolean>;
/**
 * Generates a deterministic workspace ID.
 * Priority: nxCloudId > git remote URL (hashed).
 * Returns null if neither is available (no telemetry).
 */
export declare function generateWorkspaceId(cwd?: string): string | null;
