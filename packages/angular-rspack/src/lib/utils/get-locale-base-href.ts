import { I18nOptions } from '../models';
import { addTrailingSlash, joinUrlParts, stripLeadingSlash } from './url';

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

  let joinedBaseHref: string | undefined;
  if (baseHrefSuffix !== '') {
    joinedBaseHref = addTrailingSlash(
      joinUrlParts(baseHref || '', baseHrefSuffix)
    );

    if (baseHref && baseHref[0] !== '/') {
      joinedBaseHref = stripLeadingSlash(joinedBaseHref);
    }
  }

  return joinedBaseHref;
}
