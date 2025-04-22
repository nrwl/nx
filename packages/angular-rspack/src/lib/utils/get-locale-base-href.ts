import { I18nOptions } from '../models';
import { urlJoin } from './url-join';

export function getLocaleBaseHref(
  i18n: I18nOptions,
  locale: string,
  baseHref?: string
): string | undefined {
  if (i18n.flatOutput) {
    return undefined;
  }

  const localeData = i18n.locales[locale];
  if (!localeData) {
    return undefined;
  }

  const baseHrefSuffix = localeData.baseHref ?? localeData.subPath + '/';

  return baseHrefSuffix !== ''
    ? urlJoin(baseHref || '', baseHrefSuffix)
    : undefined;
}
