"use client";

import React from "react";
import { toast as sonnerToast } from "sonner";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { buttonVariants } from "@mydaogs/ui";
import { Ban, Check, Info, LoaderCircle, X } from "lucide-react";
import { cn } from "./cn";

const DISMISS_RETRY_DELAY_MS = 400;

// Sonner delivers id-scoped dismissal through deferred animation-frame
// pub/sub that route transitions can disrupt. A second id-scoped dismiss is
// idempotent, and generation-suffixed guard/transaction ids plus monotonic
// auto ids keep the retry from ever hitting a newer toast. Never retry the
// no-id dismiss-all variant: it would dismiss unrelated toasts created
// during the retry window.
const dismissToastWithRetry = (id: string | number) => {
  sonnerToast.dismiss(id);
  setTimeout(() => {
    sonnerToast.dismiss(id);
  }, DISMISS_RETRY_DELAY_MS);
  return id;
};

interface ToastOptions {
  id?: string | number;
  action?: React.ReactNode;
  duration?: number;
  dismissible?: boolean;
  dismissOnAction?: boolean;
  onDismiss?: () => void;
}

interface ToastProps {
  title: string;
  id: string | number;
  variant?: "default" | "success" | "error" | "info" | "loading";
  dismissible?: boolean;
  dismissOnAction?: boolean;
  onDismiss?: () => void;
  action?: React.ReactNode;
}

interface ToastApi {
  (title: string, options?: ToastOptions): string | number;
  success: (title: string, options?: ToastOptions) => string | number;
  error: (title: string, options?: ToastOptions) => string | number;
  info: (title: string, options?: ToastOptions) => string | number;
  loading: (
    title: string,
    optionsOrOnDismiss?: ToastOptions | (() => void),
  ) => string | number;
  promise: <T>(
    promise: Promise<T>,
    options: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: unknown) => string);
    },
  ) => Promise<T>;
  dismiss: typeof sonnerToast.dismiss;
}

type InternalToastOptions = ToastOptions & {
  onDismiss?: () => void;
};

export const Toaster = ({ ...props }: ToasterProps) => {
  return <Sonner position="top-right" {...props} />;
};

const TOAST_VARIANT_CONFIG = {
  success: {
    icon: <Check className="h-4 w-4 shrink-0" />,
    bgClass: "bg-linear-to-br from-main via-success to-main",
  },
  error: {
    icon: <Ban className="h-4 w-4 shrink-0" />,
    bgClass: "bg-linear-to-br from-main via-danger to-main",
  },
  info: {
    icon: <Info className="h-4 w-4 shrink-0" />,
    bgClass: "bg-linear-to-br from-main via-info to-main",
  },
  loading: {
    icon: <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />,
    bgClass: "bg-linear-to-br from-main via-info to-main",
  },
  default: {
    icon: null,
    bgClass: "bg-linear-to-br from-main via-info to-main",
  },
} as const;

const Toast = ({
  title,
  id,
  variant = "default",
  dismissible,
  dismissOnAction,
  onDismiss,
  action,
}: ToastProps) => {
  const config = TOAST_VARIANT_CONFIG[variant];
  const canDismiss = dismissible !== false;

  const handleDismiss = () => {
    dismissToastWithRetry(id);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        "relative flex w-full md:max-w-[420px] items-center rounded-md p-5 ring-1 ring-black/5 shadow-shadow border-2",
        config.bgClass,
      )}
    >
      <div className="flex-1 min-w-0 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2 w-full">
          {config.icon}
          <p className="text-base font-base font-mono text-foreground break-words">
            {title}
          </p>
        </div>
        {action && (
          <div
            className="flex items-center gap-2"
            onClick={
              canDismiss && dismissOnAction !== false
                ? handleDismiss
                : undefined
            }
          >
            {action}
          </div>
        )}
      </div>
    </div>
  );
};

const TOAST_CANCEL_BUTTON_CLASSNAME = cn(
  buttonVariants({ variant: "default", size: "reset" }),
  "absolute -top-3 -right-3 flex h-6 w-6 [&_svg]:size-4",
);

const createToast = (
  variant: ToastProps["variant"],
  title: string,
  options?: InternalToastOptions,
) => {
  const canDismiss = options?.dismissible !== false;
  const onDismiss = options?.onDismiss;

  return sonnerToast.custom(
    (id) => (
      <Toast
        id={id}
        title={title}
        variant={variant}
        action={options?.action}
        dismissible={options?.dismissible}
        dismissOnAction={options?.dismissOnAction}
        onDismiss={onDismiss}
      />
    ),
    {
      id: options?.id,
      duration: options?.duration,
      dismissible: options?.dismissible,
      // The X renders through Sonner's cancel action because its handler
      // removes the toast component-locally, unlike the deferred global
      // dismiss chain that route transitions can disrupt. Sonner never
      // renders its native close button for custom-jsx toasts.
      ...(canDismiss
        ? {
            cancel: {
              label: (
                <>
                  <X aria-hidden />
                  <span className="sr-only">Dismiss</span>
                </>
              ),
              // Sonner runs onClick before its component-local deleteToast;
              // defer the callback so a throw cannot block removal.
              onClick: () => {
                if (!onDismiss) return;
                queueMicrotask(onDismiss);
              },
            },
            classNames: { cancelButton: TOAST_CANCEL_BUTTON_CLASSNAME },
          }
        : {}),
    },
  );
};

export const toast: ToastApi = (title: string, options?: ToastOptions) => {
  return createToast("default", title, options);
};

toast.success = (title: string, options?: ToastOptions) => {
  return createToast("success", title, options);
};

toast.error = (title: string, options?: ToastOptions) => {
  return createToast("error", title, options);
};

toast.info = (title: string, options?: ToastOptions) => {
  return createToast("info", title, options);
};

toast.loading = (
  title: string,
  optionsOrOnDismiss?: ToastOptions | (() => void),
) => {
  const options =
    typeof optionsOrOnDismiss === "function"
      ? { onDismiss: optionsOrOnDismiss }
      : optionsOrOnDismiss;

  return createToast("loading", title, {
    ...options,
    duration: Infinity,
  });
};

toast.promise = async <T,>(
  promise: Promise<T>,
  options: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  },
) => {
  const id = toast.loading(options.loading);

  try {
    const data = await promise;
    dismissToastWithRetry(id);
    const successMessage =
      typeof options.success === "function"
        ? options.success(data)
        : options.success;
    toast.success(successMessage);
    return data;
  } catch (error) {
    dismissToastWithRetry(id);
    const errorMessage =
      typeof options.error === "function"
        ? options.error(error)
        : options.error;
    toast.error(errorMessage);
    throw error;
  }
};

toast.dismiss = ((id?: string | number) => {
  if (id === undefined) {
    return sonnerToast.dismiss();
  }

  return dismissToastWithRetry(id);
}) as typeof sonnerToast.dismiss;
