import type { SVGProps } from "react";

// Icône SF Symbols `lock` (export Apple), library d'icônes in-app.
// Normalisée : glyphe centré, taille optique uniforme dans un canvas 24×24.
// fill-based, hérite la couleur via `currentColor`.
type LockProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function Lock({ size = 24, ...props }: LockProps) {
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
      <g transform="translate(3.995 0.5) scale(0.048)">
        <path d="M54.9316 478.76L278.32 478.76C314.209 478.76 333.252 459.229 333.252 420.654L333.252 252.441C333.252 214.111 314.209 194.58 278.32 194.58L54.9316 194.58C19.043 194.58 0 214.111 0 252.441L0 420.654C0 459.229 19.043 478.76 54.9316 478.76ZM56.1523 441.895C45.6543 441.895 39.5508 435.303 39.5508 423.34L39.5508 249.756C39.5508 237.793 45.6543 231.445 56.1523 231.445L277.1 231.445C287.842 231.445 293.701 237.793 293.701 249.756L293.701 423.34C293.701 435.303 287.842 441.895 277.1 441.895ZM42.7246 213.379L81.543 213.379L81.543 131.104C81.543 69.3359 120.85 36.8652 166.504 36.8652C212.158 36.8652 251.953 69.3359 251.953 131.104L251.953 213.379L290.527 213.379L290.527 136.23C290.527 44.4336 230.469 0 166.504 0C102.783 0 42.7246 44.4336 42.7246 136.23Z" />
      </g>
    </svg>
  );
}
