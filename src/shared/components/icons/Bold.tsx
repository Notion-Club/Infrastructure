import type { SVGProps } from "react";

// Icône SF Symbols `bold` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
type BoldProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function Bold({ size = 24, ...props }: BoldProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <g transform="translate(2.438 0.5) scale(0.066)">
        <path d="M41.2598 349.121L168.457 349.121C243.164 349.121 290.283 309.814 290.283 249.512C290.283 201.904 255.859 167.48 206.299 164.795L206.299 162.842C246.826 157.227 274.414 126.709 274.414 87.8906C274.414 33.4473 232.666 0 165.039 0L41.2598 0C15.1367 0 0 15.3809 0 42.2363L0 307.129C0 333.74 15.1367 349.121 41.2598 349.121ZM80.5664 292.725L80.5664 195.801L141.846 195.801C184.57 195.801 208.496 212.402 208.496 243.652C208.496 275.635 185.547 292.725 143.555 292.725ZM80.5664 145.02L80.5664 57.373L140.625 57.373C174.805 57.373 195.068 72.998 195.068 99.8535C195.068 128.174 172.607 145.02 134.521 145.02Z" />
      </g>
    </svg>
  );
}
