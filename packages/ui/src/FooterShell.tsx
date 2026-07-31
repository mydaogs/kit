"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { Button, InfoCard } from "@mydaogs/ui";
import { AssetLink } from "./AssetLink";
import { cn } from "./cn";

export type FooterLinkComponent = ComponentType<{
  href: string;
  className?: string;
  children: ReactNode;
  rel?: string;
  target?: string;
}>;

export interface FooterLinkItem {
  href: string;
  label: string;
  rel?: string;
  target?: string;
}

export interface FooterSection {
  title: string;
  links: FooterLinkItem[];
  /** Appends `returnToParam` to every link's href when a `returnTo` value is available. */
  withReturnTo?: boolean;
  /** Collapses each href to `pathname + search + hash` instead of rendering it absolute. */
  isSameOrigin?: boolean;
}

export interface FooterSocialLink {
  href: string;
  label: string;
  icon: ReactNode;
}

export interface FooterShellProps {
  /** Heading for the card wrapping the whole footer. Defaults to English. */
  title?: string;
  /** Generic link blocks (e.g. "Website", "App"), rendered with `linkComponent`. */
  sections: FooterSection[];
  /** Legal document links, rendered through `AssetLink` (prefetch-free, safe for static PDFs). */
  legal: FooterSection;
  social: { title: string; links: FooterSocialLink[] };
  /** Freeform contact block (e.g. a support email), rendered as-is. */
  contact: ReactNode;
  /** Freeform brand/logo block, rendered as-is. */
  brand: ReactNode;
  langSwitcher?: ReactNode;
  cookiesButton?: ReactNode;
  /** Freeform copyright block, rendered as-is. */
  copyright?: ReactNode;
  /**
   * Anchor component used for non-document links — typically the app's
   * `createCrossAppLink` output. Defaults to a plain `<a>`.
   */
  linkComponent?: FooterLinkComponent;
  sanitizeReturnTo?: (path: string) => string | null;
  /** Query param name used to round-trip the visitor's current path. Defaults to `"returnTo"`. */
  returnToParam?: string;
}

const buildHref = ({
  href,
  isSameOrigin,
  returnTo,
  returnToParam,
}: {
  href: string;
  isSameOrigin: boolean;
  returnTo: string | null;
  returnToParam: string;
}) => {
  const url = new URL(href);

  if (returnTo) {
    url.searchParams.set(returnToParam, returnTo);
  }

  return isSameOrigin
    ? `${url.pathname}${url.search}${url.hash}`
    : url.toString();
};

const FooterBlock = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <div>
    <h3 className="font-mono text-xs uppercase text-secondary text-center">
      {title}
    </h3>
    <div className="mt-4">
      <ul className="space-y-3 text-center">{children}</ul>
    </div>
  </div>
);

const DefaultLinkComponent: FooterLinkComponent = ({
  href,
  className,
  children,
  rel,
  target,
}) => (
  <a href={href} className={className} rel={rel} target={target}>
    {children}
  </a>
);

export const FooterShell = ({
  title = "Navigate",
  sections,
  legal,
  social,
  contact,
  brand,
  langSwitcher,
  cookiesButton,
  copyright,
  linkComponent,
  sanitizeReturnTo,
  returnToParam = "returnTo",
}: FooterShellProps) => {
  const LinkComponent = linkComponent ?? DefaultLinkComponent;
  const pathname = usePathname();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    const rawReturnTo = `${pathname}${window.location.search}${window.location.hash}`;
    setReturnTo(sanitizeReturnTo ? sanitizeReturnTo(rawReturnTo) : rawReturnTo);
  }, [pathname, sanitizeReturnTo]);

  return (
    <footer className="w-full px-3 pb-4 pt-6 md:px-4">
      <InfoCard title={title} className="w-full max-w-full">
        <section className="flex justify-around flex-wrap items-start gap-y-4">
          {sections.map((sectionItem) => (
            <FooterBlock key={sectionItem.title} title={sectionItem.title}>
              {sectionItem.links.map((link) => {
                const href = buildHref({
                  href: link.href,
                  isSameOrigin: Boolean(sectionItem.isSameOrigin),
                  returnTo: sectionItem.withReturnTo ? returnTo : null,
                  returnToParam,
                });
                return (
                  <li key={link.href}>
                    <Button asChild variant="link" size="sm">
                      <LinkComponent href={href} rel={link.rel} target={link.target}>
                        {link.label}
                      </LinkComponent>
                    </Button>
                  </li>
                );
              })}
            </FooterBlock>
          ))}

          <FooterBlock title={legal.title}>
            {legal.links.map((link) => (
              <li key={link.href}>
                <Button asChild variant="link" size="sm">
                  <AssetLink href={link.href}>{link.label}</AssetLink>
                </Button>
              </li>
            ))}
          </FooterBlock>

          <FooterBlock title={social.title}>
            <div className="space-y-4">
              {contact}
              <div className="mt-3 flex flex-wrap justify-center items-center gap-2">
                {social.links.map((socialLink) => (
                  <Button
                    key={socialLink.href}
                    asChild
                    variant="flat"
                    size="icon"
                    className="[&_svg]:size-8"
                  >
                    <a
                      aria-label={socialLink.label}
                      href={socialLink.href}
                      rel="noopener noreferrer"
                      target="_blank"
                      title={socialLink.label}
                    >
                      {socialLink.icon}
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          </FooterBlock>
        </section>

        <div className="flex flex-wrap gap-x-8 gap-y-4 border-t pt-4 justify-around items-center mt-8">
          {brand}

          <div
            className={cn("flex flex-wrap justify-center items-center gap-4")}
          >
            {langSwitcher}
            {cookiesButton}
          </div>

          <div className="space-y-1">{copyright}</div>
        </div>
      </InfoCard>
    </footer>
  );
};
