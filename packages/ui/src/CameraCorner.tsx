interface CameraCornerProps {
  isActive?: boolean;
  className?: string;
}

export const CameraCorner = ({
  isActive = false,
  className,
}: CameraCornerProps) =>
  isActive ? (
    <svg
      viewBox="0 0 8 8"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M0 0L10 0L10 2L2 2L2 10L0 10Z"
        className="fill-[var(--capture-color)]"
        fillOpacity={0.8}
      />
    </svg>
  ) : (
    <svg
      viewBox="0 0 8 8"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M0 0L8 0L8 2L2 2L2 8L0 8Z"
        className="fill-[var(--capture-color)]"
        fillOpacity={0.4}
      />
    </svg>
  );
