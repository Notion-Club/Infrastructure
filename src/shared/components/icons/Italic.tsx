import type { SVGProps } from "react";

// Icône SF Symbols `italic` (export Apple), library d'icônes in-app.
// fill-based, hérite la couleur via `currentColor`.
type ItalicProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function Italic({ size = 24, ...props }: ItalicProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 252.93 349.365"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M19.5312 349.121L173.828 349.121C185.303 349.121 193.604 342.041 193.604 330.566C193.604 319.58 185.547 312.5 174.072 312.5L119.385 312.5L178.711 36.6211L233.398 36.6211C244.873 36.6211 252.93 29.541 252.93 18.0664C252.93 7.08008 245.117 0 233.643 0L78.6133 0C67.1387 0 59.3262 7.08008 59.3262 18.0664C59.3262 29.541 67.3828 36.6211 78.8574 36.6211L133.545 36.6211L74.2188 312.5L19.2871 312.5C7.8125 312.5 0 319.58 0 330.566C0 342.041 8.05664 349.121 19.5312 349.121Z" />
    </svg>
  );
}
