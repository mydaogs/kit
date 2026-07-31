import { forwardRef, type ComponentPropsWithoutRef } from "react";

export type AssetLinkProps = ComponentPropsWithoutRef<"a">;

/**
 * Static assets (PDFs, downloads) served from `public/`, not Next.js routes.
 * Rendering them through next/link makes Next prefetch each one as an RSC
 * navigation (`?_rsc=...`), which 404s because there is no route to render.
 * A native anchor avoids prefetch and lets the browser fetch the asset directly.
 */
export const AssetLink = forwardRef<HTMLAnchorElement, AssetLinkProps>(
  (
    { children, target = "_blank", rel = "noopener noreferrer", ...rest },
    ref,
  ) => (
    <a ref={ref} target={target} rel={rel} {...rest}>
      {children}
    </a>
  ),
);

AssetLink.displayName = "AssetLink";
