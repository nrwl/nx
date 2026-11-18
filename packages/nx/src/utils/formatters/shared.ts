/**
 * Formatters list every mismatching path on stdout, which overruns Node's 1MB
 * default on a large workspace.
 */
export const FORMATTER_MAX_BUFFER = 50 * 1024 * 1024;
