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

// Angular v22 renamed the SSR `experimentalPlatform` option to `platform` and
// dropped the old key. We accept both from users; forward the one the installed
// builder understands so a `neutral` value is never silently dropped.
export function coerceSsrPlatformOption(
  ssr: SsrPlatformInput | undefined
): SsrOption {
  if (!ssr || typeof ssr !== 'object') {
    return ssr as SsrOption;
  }

  const { platform, experimentalPlatform, ...rest } = ssr;
  const resolvedPlatform = platform ?? experimentalPlatform;
  if (resolvedPlatform === undefined) {
    return ssr as SsrOption;
  }

  const angularMajorVersion = getInstalledAngularVersionInfo()?.major;

  return (
    angularMajorVersion === undefined || angularMajorVersion >= 22
      ? { ...rest, platform: resolvedPlatform }
      : { ...rest, experimentalPlatform: resolvedPlatform }
  ) as SsrOption;
}
