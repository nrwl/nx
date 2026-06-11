export interface Example {
    command: string;
    description: string;
}
export interface CliDocsCommandMetadata {
    supportedVersionRange?: string;
}
/**
 * Docs-only metadata keyed by the full command name as rendered in the CLI docs.
 */
export declare const cliDocsCommandMetadata: Record<string, CliDocsCommandMetadata>;
export declare const examples: Record<string, Example[]>;
