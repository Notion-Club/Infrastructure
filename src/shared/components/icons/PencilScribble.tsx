import type { SVGProps } from "react";

// Icône SF Symbols `pencil.and.scribble` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
type PencilScribbleProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function PencilScribble({ size = 24, ...props }: PencilScribbleProps) {
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
      <g transform="translate(0.5 2.211) scale(0.034)">
        <path d="M5.18771 439.484C26.9162 510.773 134.826 522.247 249.572 469.269C270.569 459.747 256.164 432.892 236.389 442.413C140.686 487.823 48.8889 481.476 33.7522 430.939C-4.82206 304.718 266.662 290.558 235.412 184.357C219.787 132.111 99.1818 140.655 13.0002 198.761C-4.33378 209.991 12.2678 234.894 29.3576 223.175C91.8576 181.671 198.547 165.314 206.848 192.657C212.951 213.165 195.862 228.302 128.479 265.9C62.8049 302.277-21.9119 350.372 5.18771 439.484Z" />
        <path d="M351.379 423.37L611.145 163.849L568.42 120.88L308.655 380.402L285.461 434.601C283.02 440.46 289.123 447.296 295.227 444.855ZM632.629 142.853L657.287 118.683C669.738 106.232 670.471 92.8039 659.24 81.5734L650.94 73.2726C639.709 62.2863 626.281 63.2629 614.074 75.4699L589.172 99.884Z" />
      </g>
    </svg>
  );
}
