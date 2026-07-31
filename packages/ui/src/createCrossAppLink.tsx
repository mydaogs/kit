"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

export type CreateCrossAppLinkOptions = {
  /** Hostnames (and their dev-host equivalents) considered part of this app's ecosystem. */
  hosts: string[];
  /** Query param used to carry the locale across app boundaries. Defaults to `"locale"`. */
  localeParam?: string;
  /** Returns the visitor's current locale, e.g. `next-intl`'s `useLocale`. */
  useLocale: () => string;
};

export type CrossAppLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string | URL;
};

/**
 * Builds an `<AppLink>` that appends the current locale as a query param when
 * navigating to a URL outside this app's own host but still within the given
 * `hosts` list — so a cross-app hop doesn't lose the visitor's locale.
 */
export const createCrossAppLink = ({
  hosts,
  localeParam = "locale",
  useLocale,
}: CreateCrossAppLinkOptions) => {
  const isCrossAppHref = (href: string): boolean => {
    if (!href.startsWith("http")) return false;
    try {
      const { hostname, host } = new URL(href);
      return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`) || host === h);
    } catch {
      return false;
    }
  };

  const appendLocaleParam = (href: string, locale: string) => {
    const url = new URL(href);
    url.searchParams.set(localeParam, locale);
    return `${url.origin}${url.pathname}${url.search}${url.hash}`;
  };

  return function CrossAppLink({ href, ...rest }: CrossAppLinkProps) {
    const locale = useLocale();
    const hrefString = href instanceof URL ? href.toString() : href;
    const shouldAppendLocale = isCrossAppHref(hrefString);

    return (
      <Link
        href={
          shouldAppendLocale ? appendLocaleParam(hrefString, locale) : hrefString
        }
        {...rest}
      />
    );
  };
};
