/* eslint-disable @typescript-eslint/no-restricted-imports */
/**
 * Side-effect module: registers a jest mock of `fs`/`node:fs` backed by memfs
 * for specs that exercise the filesystem. It must remain a dedicated subpath
 * (not part of the internal-testing-utils barrel) because importing it applies
 * the mock — a barrel import would do so for every consumer.
 */
import 'nx/src/internal-testing-utils/mock-fs';
