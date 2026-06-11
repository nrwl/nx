/**
 * This is currently duplicated in Nx Console. Please let @MaxKless know if you make changes here.
 */
export declare function createNxCloudOnboardingURL(onboardingSource: string, accessToken?: string, meta?: string, forceManual?: boolean, forceGithub?: boolean, directory?: string): Promise<string>;
export declare function getURLifShortenFailed(usesGithub: boolean, githubSlug: string | null, apiUrl: string, source: string, accessToken?: string): string;
