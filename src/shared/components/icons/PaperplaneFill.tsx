import type { SVGProps } from "react";

// Icône SF Symbols `paperplane.fill` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
type PaperplaneFillProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function PaperplaneFill({ size = 24, ...props }: PaperplaneFillProps) {
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
      <g transform="translate(0.5 -0.554) scale(0.045)">
        <path d="M305.664 534.912C323.242 534.912 335.693 519.775 344.727 496.338L504.639 78.6133C509.033 67.3828 511.475 57.373 511.475 49.0723C511.475 33.2031 501.709 23.4375 485.84 23.4375C477.539 23.4375 467.529 25.8789 456.299 30.2734L36.377 191.162C15.8691 198.975 0 211.426 0 229.248C0 251.709 17.0898 259.277 40.5273 266.357L172.363 306.396C187.988 311.279 196.777 310.791 207.275 301.025L475.098 50.7812C478.271 47.8516 481.934 48.3398 484.375 50.5371C486.816 52.9785 487.061 56.6406 484.131 59.8145L234.863 328.613C225.342 338.623 224.609 346.924 229.248 363.281L268.066 492.188C275.391 516.846 282.959 534.912 305.664 534.912Z" />
      </g>
    </svg>
  );
}
