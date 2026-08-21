/* eslint-disable @typescript-eslint/no-restricted-imports */
/**
 * Side-effect module: registers a jest mock of `prettier` (whose v3 dynamic
 * imports fail in Jest's VM) for specs that format output. It must remain a
 * dedicated subpath (not part of the internal-testing-utils barrel) because
 * importing it applies the mock — a barrel import would do so for every
 * consumer.
 */
import 'nx/src/internal-testing-utils/mock-prettier';
