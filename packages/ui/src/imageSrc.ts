export type AppImageSrc =
  | string
  | {
      src: string;
      width?: number;
      height?: number;
      blurDataURL?: string;
      blurWidth?: number;
      blurHeight?: number;
    }
  | {
      default: {
        src: string;
        width?: number;
        height?: number;
        blurDataURL?: string;
        blurWidth?: number;
        blurHeight?: number;
      };
    };

export const resolveImageSrc = (src: AppImageSrc): string => {
  if (typeof src === "string") return src;
  return "default" in src ? src.default.src : src.src;
};
