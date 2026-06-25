import type { SVGProps } from "react";

// Icône SF Symbols `iphone` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
type IphoneProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function Iphone({ size = 24, ...props }: IphoneProps) {
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
      <g transform="translate(5.02 0.5) scale(0.045)">
        <path d="M66.4062 516.846L247.314 516.846C287.109 516.846 313.721 491.455 313.721 453.369L313.721 63.4766C313.721 25.3906 287.109 0 247.314 0L66.4062 0C26.6113 0 0 25.3906 0 63.4766L0 453.369C0 491.455 26.6113 516.846 66.4062 516.846ZM71.5332 477.539C50.7812 477.539 39.3066 466.553 39.3066 447.021L39.3066 69.8242C39.3066 50.293 50.7812 39.3066 71.5332 39.3066L242.432 39.3066C262.939 39.3066 274.414 50.293 274.414 69.8242L274.414 447.021C274.414 466.553 262.939 477.539 242.432 477.539ZM105.225 459.717L208.984 459.717C215.576 459.717 220.215 455.078 220.215 448.242C220.215 441.406 215.576 437.012 208.984 437.012L105.225 437.012C98.6328 437.012 93.75 441.406 93.75 448.242C93.75 455.078 98.6328 459.717 105.225 459.717ZM127.441 91.0645L186.523 91.0645C196.045 91.0645 203.613 83.4961 203.613 73.7305C203.613 64.209 196.045 56.6406 186.523 56.6406L127.441 56.6406C117.676 56.6406 110.107 64.209 110.107 73.7305C110.107 83.4961 117.676 91.0645 127.441 91.0645Z" />
      </g>
    </svg>
  );
}
