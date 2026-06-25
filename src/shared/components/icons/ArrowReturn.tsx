import type { SVGProps } from "react";

// Icône SF Symbols `return` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
type ArrowReturnProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function ArrowReturn({ size = 24, ...props }: ArrowReturnProps) {
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
      <g transform="translate(0.5 1.993) scale(0.045)">
        <path d="M24.4141 284.424C24.4141 294.434 32.7148 302.002 42.7246 302.49L122.803 306.152L434.57 306.152C491.455 306.152 515.137 280.029 515.137 224.854L515.137 80.5664C515.137 23.6816 491.455 0 434.57 0L297.852 0C284.424 0 275.635 9.76562 275.635 21.7285C275.635 33.6914 284.424 43.457 297.852 43.457L434.57 43.457C460.449 43.457 471.436 54.6875 471.436 80.5664L471.436 224.854C471.436 251.465 460.449 262.695 434.57 262.695L122.803 262.695L42.7246 266.113C32.7148 266.602 24.4141 274.17 24.4141 284.424ZM0 284.424C0 290.283 2.44141 296.143 7.32422 300.781L150.879 441.65C155.029 445.801 161.377 448.242 166.504 448.242C179.688 448.242 188.232 439.453 188.232 426.758C188.232 420.41 186.035 415.771 182.373 411.865L111.816 343.262L51.5137 291.504L51.5137 277.1L111.816 225.586L182.373 156.982C186.035 153.076 188.232 148.193 188.232 141.846C188.232 129.395 179.688 120.361 166.504 120.361C161.377 120.361 155.029 123.047 150.879 127.197L7.32422 268.066C2.44141 272.705 0 278.32 0 284.424Z" />
      </g>
    </svg>
  );
}
