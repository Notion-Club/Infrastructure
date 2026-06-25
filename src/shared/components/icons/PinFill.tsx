import type { SVGProps } from "react";

// Icône SF Symbols `pin.fill` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
type PinFillProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function PinFill({ size = 24, ...props }: PinFillProps) {
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
      <g transform="translate(5.338 1.468) scale(0.035)">
        <path d="M0 367.432C0 388.184 13.916 401.855 35.8887 401.855L167.969 401.855L167.969 515.869C167.969 553.223 183.594 584.229 189.697 584.229C195.557 584.229 211.182 553.223 211.182 515.869L211.182 401.855L343.262 401.855C365.234 401.855 379.15 388.184 379.15 367.432C379.15 315.918 337.891 261.475 269.287 236.572L261.23 124.512C296.875 104.248 326.172 81.2988 338.867 64.9414C345.215 56.6406 348.389 48.3398 348.389 41.0156C348.389 26.123 336.914 15.1367 319.824 15.1367L59.5703 15.1367C42.2363 15.1367 31.0059 26.123 31.0059 41.0156C31.0059 48.3398 33.9355 56.6406 40.2832 64.9414C52.9785 81.2988 82.2754 104.248 117.92 124.512L109.863 236.572C41.2598 261.475 0 315.918 0 367.432Z" />
      </g>
    </svg>
  );
}
