interface CameraMiddleProps {
  className?: string;
}

export const CameraMiddle = ({ className }: CameraMiddleProps) => (
  <svg
    viewBox="0 0 12 7"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M0 0L12 0L12 2L0 2Z"
      className="fill-[var(--capture-color)]"
      fillOpacity={0.9}
    />
    <path
      d="M5 3V7H7V3H5Z"
      className="fill-[var(--capture-color)]"
      fillOpacity={0.7}
    />
  </svg>
);
