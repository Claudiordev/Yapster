import { IconSvgProps } from "@/types";

export const EditIcon = ({
  size = 16,
  width,
  height,
  ...props
}: IconSvgProps) => (
  <svg
    fill="none"
    height={size || height}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={2}
    viewBox="0 0 24 24"
    width={size || width}
    {...props}
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
