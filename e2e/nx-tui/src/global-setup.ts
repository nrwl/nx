/**
 * We can reuse the jest-based setup for handling nx release and registry publishing
 * as-is because it doesn't actually have any jest specific code or logic.
 */
// eslint-disable-next-line @nx/enforce-module-boundaries
import jestGlobalSetup from '../../utils/global-setup';

export default async function globalSetup() {
  await jestGlobalSetup({});
}
