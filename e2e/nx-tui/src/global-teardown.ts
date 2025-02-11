/**
 * We can reuse the jest-based teardown the local registry process and config
 * as-is because it doesn't actually have any jest specific code or logic.
 */
// eslint-disable-next-line @nx/enforce-module-boundaries
import jestGlobalTeardown from '../../utils/global-teardown';

export default async function globalTeardown() {
  jestGlobalTeardown();
}
