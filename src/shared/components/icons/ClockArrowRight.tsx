import type { SVGProps } from "react";

// Icône lucide `clock-arrow-right`, recopiée fidèlement depuis lucide.dev :
// elle est ABSENTE de la version de lucide-react installée (v1.16.0, qui n'a
// que ClockArrowUp / ClockArrowDown). On évite un bump de dépendance risqué en
// fournissant un composant local à l'API alignée sur les icônes lucide
// (size, strokeWidth, héritage de couleur via `currentColor`).
type ClockArrowRightProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
  strokeWidth?: number | string;
};

export function ClockArrowRight({
  size = 24,
  strokeWidth = 2,
  ...props
}: ClockArrowRightProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 6v6l2 1" />
      <path d="M13.5 21.885A10 10 0 1 1 22 12" />
      <path d="M14 18h8" />
      <path d="m18 22 4-4-4-4" />
    </svg>
  );
}
