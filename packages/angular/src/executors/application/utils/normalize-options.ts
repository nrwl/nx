import { getInstalledAngularVersionInfo } from '../../utilities/angular-version-utils';
import type { ApplicationExecutorOptions } from '../schema';

type SsrOption = ApplicationExecutorOptions['ssr'];

// The `platform`/`experimentalPlatform` keys are version-specific in the builder
// types (v22 only knows `platform`, earlier majors only `experimentalPlatform`),
// so the input is widened to read both and the result is cast back.
type SsrPlatformInput =
  | boolean
  | {
      entry?: string;
      platform?: 'node' | 'neutral';
      experimentalPlatform?: 'node' | 'neutral';
    };

export function normalizeOptions(
  options: ApplicationExecutorOptions
): ApplicationExecutorOptions {
  return { ...options, ssr: coerceSsrPlatform(options.ssr) };
}

// `platform` is the option name from Angular v22 onwards; earlier majors use
// `experimentalPlatform`. We accept both and forward the one the installed
// builder understands so a `neutral` value is never silently dropped.
function coerceSsrPlatform(ssr: SsrPlatformInput | undefined): SsrOption {
  if (!ssr || typeof ssr !== 'object') {
    return ssr as SsrOption;
  }

  const { platform, experimentalPlatform, ...rest } = ssr;
  const resolvedPlatform = platform ?? experimentalPlatform;
  if (resolvedPlatform === undefined) {
    return ssr as SsrOption;
  }

  // `validateOptions` runs first and asserts Angular is installed, so the
  // version info is always present here.
  const { major: angularMajorVersion } = getInstalledAngularVersionInfo();

  return (
    angularMajorVersion >= 22
      ? { ...rest, platform: resolvedPlatform }
      : { ...rest, experimentalPlatform: resolvedPlatform }
  ) as SsrOption;
}
