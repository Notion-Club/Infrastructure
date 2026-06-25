import type { SVGProps } from "react";

// Icône SF Symbols `moon` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
type MoonProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function Moon({ size = 24, ...props }: MoonProps) {
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
      <g transform="translate(0.569 0.5) scale(0.047)">
        <path d="M256.011 492.902C362.456 492.902 448.638 428.693 486.968 346.906C495.269 329.816 484.283 318.341 467.925 323.468C449.859 329.572 420.074 335.431 392.486 335.431C246.001 335.431 162.017 251.447 162.017 104.718C162.017 77.1303 168.12 46.1244 176.91 23.9076C183.99 5.8412 171.538-5.14513 154.204 2.42323C66.558 40.5092 0.151713 130.109 0.151713 237.042C0.151713 378.4 114.898 492.902 256.011 492.902ZM256.011 455.06C135.894 455.06 37.9935 357.404 37.9935 237.042C37.9935 161.847 77.5443 98.6146 129.058 61.2611C125.884 75.6654 124.175 89.5814 124.175 104.718C124.175 272.443 225.005 373.273 392.486 373.273C405.425 373.273 417.632 371.564 427.886 369.611C390.044 419.904 328.277 455.06 256.011 455.06Z" />
      </g>
    </svg>
  );
}
