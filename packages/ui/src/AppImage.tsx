"use client";

import Image from "next/image";
import { LoaderCircle } from "lucide-react";
import { useImageLoadState } from "./hooks/useImageLoadState";
import { cn } from "./cn";
import type { ReactNode } from "react";
import type { ImageProps as NextImageProps } from "next/image";
import { resolveImageSrc, type AppImageSrc } from "./imageSrc";

export type AppImageProps = Omit<NextImageProps, "src"> & {
  src: AppImageSrc;
  wrapperClassName?: string;
  imageClassName?: string;
  /** Optional short label rendered on top of the image (styled like the form Label). */
  label?: ReactNode;
  labelClassName?: string;
  /** Screen-reader label for the loading spinner. Defaults to English — pass a
   * translated string from the consuming app. */
  loadingLabel?: string;
};

export const AppImage = (props: AppImageProps) => {
  const {
    src,
    alt,
    fill,
    onLoad,
    onError,
    className,
    wrapperClassName,
    imageClassName,
    label,
    labelClassName,
    loadingLabel = "Loading image",
    ...imageProps
  } = props;
  const resolvedSrc = resolveImageSrc(src);
  const { isLoaded, markLoaded, markError } = useImageLoadState(
    resolvedSrc,
    "app-image",
  );

  return (
    <div
      className={cn(
        "relative",
        fill ? "h-full w-full" : "inline-block",
        wrapperClassName,
      )}
    >
      {label ? (
        <span
          className={cn(
            // Mirrors the shared form Label typography (text-sm font-heading
            // leading-none px-1), positioned over the top-left of the image.
            "absolute left-2 top-2 z-10 px-1 text-sm font-heading leading-none text-foreground",
            labelClassName,
          )}
        >
          {label}
        </span>
      ) : null}
      {!isLoaded ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          role="status"
          aria-label={loadingLabel}
        >
          <LoaderCircle className="size-4 animate-spin" />
        </div>
      ) : null}
      <Image
        {...imageProps}
        alt={alt}
        fill={fill}
        src={src as NextImageProps["src"]}
        className={cn(
          className,
          imageClassName,
          "transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={(event) => {
          onLoad?.(event);
          markLoaded();
        }}
        onError={(event) => {
          onError?.(event);
          markError();
        }}
      />
    </div>
  );
};
