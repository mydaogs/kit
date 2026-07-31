"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, LoaderCircle, X } from "lucide-react";
import {
  createContext,
  type ComponentProps,
  type MouseEvent,
  type RefObject,
  type ReactNode,
  useEffect,
  useContext,
  useRef,
  useState,
} from "react";
import Image from "next/image";

import { useImageLoadState } from "./hooks/useImageLoadState";
import { cn } from "./cn";
import { Button } from "@mydaogs/ui";
import { resolveImageSrc, type AppImageSrc } from "./imageSrc";

export type AppImagePreviewWrapperProps = Omit<
  ComponentProps<"button">,
  "children" | "type"
> & {
  href: AppImageSrc;
  alt: string;
  enableDownload?: boolean;
  downloadFileName?: string;
  overlayContent?: ReactNode;
  children: ReactNode;
};

export type AppImagePreviewProps = AppImagePreviewWrapperProps;

type AppImagePreviewContextValue = {
  openPreview: (payload: AppImagePreviewPayload) => void;
};

type AppImagePreviewPayload = {
  href: AppImageSrc;
  alt: string;
  enableDownload?: boolean;
  downloadFileName?: string;
  overlayContent?: ReactNode;
};

const AppImagePreviewContext =
  createContext<AppImagePreviewContextValue | null>(null);

const CLOSE_ANIMATION_MS = 200;

const resolveDownloadFilename = (src: string, alt: string) => {
  const fileName = (() => {
    try {
      return new URL(src, window.location.href).pathname.split("/").pop();
    } catch {
      return src.split("/").pop();
    }
  })();

  const cleanedName = fileName
    ? decodeURIComponent(fileName)
        .replace(/\.([a-f0-9]{8,})(?=\.[^.]+$)/i, "")
        .replace(/\.([a-f0-9]{8,})$/i, "")
    : "";

  if (cleanedName) return cleanedName;

  return (
    alt
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/-+/g, "-") || "image"
  );
};

const downloadPreviewImage = async (src: string, filename: string) => {
  const url = new URL(src, window.location.href);
  const isDownloadableDirectly =
    url.origin === window.location.origin ||
    url.protocol === "blob:" ||
    url.protocol === "data:";

  if (!isDownloadableDirectly) {
    try {
      const response = await fetch(url.toString());

      if (response.ok) {
        const blobUrl = URL.createObjectURL(await response.blob());
        const blobLink = document.createElement("a");

        blobLink.href = blobUrl;
        blobLink.download = filename;
        blobLink.rel = "noopener";
        document.body.appendChild(blobLink);
        blobLink.click();
        blobLink.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        return;
      }

      console.warn(
        "AppImagePreview download fell back to the browser because the remote image responded without a downloadable blob. Cross-origin hosts need CORS access for reliable downloads.",
      );
    } catch {
      console.warn(
        "AppImagePreview download fell back to the browser because the remote image could not be fetched as a blob. Cross-origin hosts need CORS access for reliable downloads.",
      );
    }
  }

  const link = document.createElement("a");
  link.href = url.toString();
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const PreviewImage = ({ href, alt }: { href: AppImageSrc; alt: string }) => {
  const resolvedSrc = resolveImageSrc(href);
  const { isLoaded, markLoaded, markError } = useImageLoadState(
    resolvedSrc,
    "app-image-preview",
  );

  const imageSizes = "(min-width: 80rem) 80rem, 80vw";

  return (
    <div className="relative h-[min(80dvh,calc(100dvh-8rem))] w-[min(80vw,80rem)] max-w-full max-h-[calc(100dvh-8rem)]">
      {!isLoaded ? (
        <div
          className="absolute inset-0 flex items-center justify-center"
          role="status"
          aria-label="Loading image"
        >
          <LoaderCircle className="size-8 animate-spin" />
        </div>
      ) : null}
      <Image
        src={resolvedSrc}
        alt={alt}
        fill
        sizes={imageSizes}
        className={cn(
          "object-contain transition-opacity duration-300",
          isLoaded ? "opacity-100" : "opacity-0",
        )}
        onLoad={markLoaded}
        onError={markError}
      />
    </div>
  );
};

const PreviewBackdropClose = ({
  backdropCloseRef,
}: {
  backdropCloseRef: RefObject<HTMLButtonElement | null>;
}) => (
  <DialogPrimitive.Close
    aria-label="Close image preview"
    className="absolute inset-0 z-[55] cursor-zoom-out border-0 bg-transparent p-0 outline-none pointer-events-auto"
    ref={backdropCloseRef}
    type="button"
  />
);

export const AppImagePreviewWrapper = ({
  enableDownload,
  downloadFileName,
  overlayContent,
  className,
  onClick,
  href,
  alt,
  children,
  ...props
}: AppImagePreviewWrapperProps) => {
  const context = useContext(AppImagePreviewContext);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    context?.openPreview({
      href,
      alt,
      enableDownload,
      downloadFileName,
      overlayContent,
    });
  };

  return (
    <button
      aria-haspopup="dialog"
      className={cn(
        "relative inline-block cursor-zoom-in border-0 bg-transparent p-0",
        className,
      )}
      onClick={handleClick}
      type="button"
      {...props}
    >
      {children}
    </button>
  );
};

export const AppImagePreview = AppImagePreviewWrapper;

export const AppImagePreviewCaption = ({
  className,
  children,
  ...props
}: ComponentProps<"div">) => {
  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-[56] flex justify-center px-4 pb-4",
        className,
      )}
      {...props}
    >
      <div className="max-w-full rounded-full border-2 border-border/70 bg-background/85 px-3 py-1 text-xs font-base text-foreground shadow-shadow backdrop-blur">
        {children}
      </div>
    </div>
  );
};

export const AppImagePreviewProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [activePreview, setActivePreview] =
    useState<AppImagePreviewPayload | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const backdropCloseRef = useRef<HTMLButtonElement>(null);
  const clearActivePreviewTimerRef = useRef<number | null>(null);

  const cancelClearActivePreview = () => {
    if (clearActivePreviewTimerRef.current !== null) {
      window.clearTimeout(clearActivePreviewTimerRef.current);
      clearActivePreviewTimerRef.current = null;
    }
  };

  useEffect(() => cancelClearActivePreview, []);

  return (
    <AppImagePreviewContext.Provider
      value={{
        openPreview: (payload) => {
          cancelClearActivePreview();
          setActivePreview(payload);
          setIsOpen(true);
        },
      }}
    >
      {children}
      <DialogPrimitive.Root
        open={isOpen}
        onOpenChange={(open) => {
          setIsOpen(open);
          if (!open) {
            cancelClearActivePreview();
            clearActivePreviewTimerRef.current = window.setTimeout(() => {
              setActivePreview(null);
              clearActivePreviewTimerRef.current = null;
            }, CLOSE_ANIMATION_MS);
          }
        }}
      >
        {activePreview ? (
          // z-[55] keeps the preview above z-50 dialogs/drawers but below the global toaster.
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay
              className={cn(
                "fixed inset-0 z-[55] bg-overlay/60 backdrop-blur-xs pointer-events-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:pointer-events-none data-[state=closed]:invisible data-[state=open]:fade-in-0",
              )}
              forceMount
            />
            <DialogPrimitive.Content
              className={cn(
                "fixed inset-x-0 top-0 z-[55] flex h-dvh items-center justify-center p-4 outline-none pointer-events-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:pointer-events-none data-[state=closed]:invisible data-[state=open]:fade-in-0",
              )}
              forceMount
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                backdropCloseRef.current?.focus();
              }}
            >
              <DialogPrimitive.Title className="sr-only">
                Image preview
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="sr-only">
                Full screen image preview
              </DialogPrimitive.Description>
              <PreviewBackdropClose backdropCloseRef={backdropCloseRef} />
              <div className="pointer-events-none relative flex min-h-full w-full flex-col items-center justify-center gap-4">
                <div className="pointer-events-auto relative inline-flex flex-col items-center justify-center">
                  <PreviewImage
                    href={activePreview.href}
                    alt={activePreview.alt}
                  />
                  {activePreview.overlayContent}
                </div>
              </div>
              <div className="absolute right-4 top-4 z-[57] flex items-center gap-2 pointer-events-auto">
                {activePreview.enableDownload ? (
                  <Button
                    aria-label="Download image"
                    size="icon"
                    className="[&_svg]:size-6"
                    onClick={() => {
                      const resolvedSrc = resolveImageSrc(activePreview.href);
                      const filename =
                        activePreview.downloadFileName ??
                        resolveDownloadFilename(resolvedSrc, activePreview.alt);

                      void downloadPreviewImage(resolvedSrc, filename);
                    }}
                  >
                    <Download />
                  </Button>
                ) : null}
                <DialogPrimitive.Close asChild>
                  <Button
                    size="icon"
                    aria-label="Close image preview"
                    className="[&_svg]:size-6"
                  >
                    <X />
                  </Button>
                </DialogPrimitive.Close>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </DialogPrimitive.Root>
    </AppImagePreviewContext.Provider>
  );
};
