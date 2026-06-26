import type { SVGProps } from "react";

// Icône SF Symbols `desktopcomputer` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
type DesktopcomputerProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function Desktopcomputer({ size = 24, ...props }: DesktopcomputerProps) {
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
      <g transform="translate(0 1.5) scale(0.0412)">
        <path d="M56.1523 422.363L525.635 422.363C560.791 422.363 582.031 401.123 582.031 365.967L582.031 73.2422C582.031 38.0859 560.791 17.0898 525.635 17.0898L56.1523 17.0898C21.2402 17.0898 0 38.0859 0 73.2422L0 365.967C0 401.123 21.2402 422.363 56.1523 422.363ZM49.8047 314.697C42.4805 314.697 39.3066 312.012 39.3066 304.199L39.3066 73.9746C39.3066 62.9883 46.1426 56.3965 56.8848 56.3965L525.146 56.3965C535.889 56.3965 542.725 62.9883 542.725 73.9746L542.725 304.199C542.725 312.012 539.307 314.697 531.982 314.697ZM213.867 480.469L368.164 480.469L368.164 419.189L213.867 419.189ZM212.402 509.033L369.629 509.033C380.371 509.033 389.16 500.244 389.16 489.258C389.16 478.271 380.371 469.482 369.629 469.482L212.402 469.482C201.66 469.482 192.627 478.271 192.627 489.258C192.627 500.244 201.66 509.033 212.402 509.033Z" />
      </g>
    </svg>
  );
}
