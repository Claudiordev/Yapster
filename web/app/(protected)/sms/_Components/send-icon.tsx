import { IconSvgProps } from "@/types";

export const SendIcon = ({ size = 24, width, height, ...props }: IconSvgProps) => (
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
    <path d="M22 2L11 13" />
    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </svg>
);
