import { cn } from "./cn";
import { CameraCorner } from "./CameraCorner";
import { CameraMiddle } from "./CameraMiddle";

interface CaptureBtnBgProps {
  isActive: boolean;
  className?: string;
}

const cornerConfigs = [
  { key: "tl", className: "absolute top-0 left-0 h-2 w-2" },
  { key: "tr", className: "absolute top-0 right-0 rotate-90 h-2 w-2" },
  { key: "bl", className: "absolute bottom-0 left-0 -rotate-90 h-2 w-2" },
  { key: "br", className: "absolute bottom-0 right-0 rotate-180 h-2 w-2" },
] as const;

export const CaptureBtnBg = ({ isActive, className }: CaptureBtnBgProps) => (
  <div
    className={cn(
      "absolute inset-0 transition-transform duration-150 pointer-events-none",
      isActive
        ? "[--capture-color:var(--capture-btn-active)] scale-110 bg-capture-btn-active/30"
        : "[--capture-color:var(--capture-btn-inactive)]",
      className,
    )}
  >
    {cornerConfigs.map(({ key, className: cornerClassName }) => (
      <CameraCorner
        key={key}
        isActive={isActive}
        className={cn(cornerClassName, "transition-opacity duration-150")}
      />
    ))}
    {isActive && (
      <CameraMiddle className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 transition-opacity duration-150" />
    )}
  </div>
);
