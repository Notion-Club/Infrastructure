import type { SVGProps } from "react";

// Icône SF Symbols `message.badge.filled.fill` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
// Bicolore : pastille « non-lu » en rouge brand quand `unread` est vrai.
type MessageBadgeProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
  unread?: boolean;
};

export function MessageBadge({ size = 24, unread = false, ...props }: MessageBadgeProps) {
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
      <g transform="translate(0.425 2.491) scale(0.035)">
        <path d="M434.546 60.677C424.913 77.6955 419.434 97.3266 419.434 118.164C419.434 182.861 472.656 236.084 537.354 236.084C560.626 236.084 582.467 229.145 600.823 217.153C607.01 236.79 610.107 257.798 610.107 279.785C610.107 415.771 491.455 514.648 327.637 514.648C273.926 514.648 224.854 504.639 182.617 485.352C157.471 503.662 123.047 514.648 89.3555 514.648C73.2422 514.648 67.3828 502.686 78.3691 492.92C93.0176 479.248 99.1211 466.797 99.1211 447.754C99.1211 404.053 45.4102 377.686 45.4102 279.785C45.4102 143.555 164.062 44.9219 327.637 44.9219C366.11 44.9219 402.112 50.3783 434.546 60.677Z" />
        <path d="M537.354 202.881C583.496 202.881 622.07 164.795 622.07 118.408C622.07 71.7773 583.496 33.6914 537.354 33.6914C490.967 33.6914 452.637 71.7773 452.637 118.408C452.637 164.795 490.967 202.881 537.354 202.881Z" fill={unread ? "var(--color-brand, #e0625a)" : "currentColor"} />
      </g>
    </svg>
  );
}
