/**
 * Gets the Nx Console status (whether we should prompt the user to install).
 * Uses latest Nx version if available, falls back to local implementation.
 *
 * @returns boolean indicating whether we should prompt the user
 */
export declare function getNxConsoleStatus({ inner, }?: {
    inner?: boolean;
}): Promise<boolean>;
/**
 * Handles user preference submission and installs Nx Console if requested.
 * Uses latest Nx version if available, falls back to local implementation.
 *
 * @param preference - whether the user wants to install Nx Console
 * @returns object indicating whether installation succeeded
 */
export declare function handleNxConsolePreferenceAndInstall({ preference, inner, }: {
    preference: boolean;
    inner?: boolean;
}): Promise<{
    installed: boolean;
}>;
export declare function getNxConsoleStatusImpl(): Promise<boolean>;
export declare function handleNxConsolePreferenceAndInstallImpl(preference: boolean): Promise<{
    installed: boolean;
}>;
