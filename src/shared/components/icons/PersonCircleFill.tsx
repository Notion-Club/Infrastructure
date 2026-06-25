import type { SVGProps } from "react";

// Icône SF Symbols `person.crop.circle.fill` (export Apple), library d'icônes in-app.
// fill-based, hérite la couleur via `currentColor`.
type PersonCircleFillProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  size?: number | string;
};

export function PersonCircleFill({ size = 24, ...props }: PersonCircleFillProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 498.047 498.291"
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M498.047 249.023C498.047 386.23 386.475 498.047 249.023 498.047C111.816 498.047 0 386.23 0 249.023C0 111.572 111.816 0 249.023 0C386.475 0 498.047 111.572 498.047 249.023ZM98.877 398.193C136.23 437.988 192.871 460.938 248.779 460.938C304.932 460.938 361.328 437.988 398.926 398.193C372.314 356.201 314.453 332.275 248.779 332.275C182.617 332.275 125.244 356.689 98.877 398.193ZM165.039 198.73C165.039 251.221 201.904 290.283 248.779 290.771C295.898 291.26 332.52 251.221 332.52 198.73C332.52 149.414 295.654 108.398 248.779 108.398C202.148 108.398 164.795 149.414 165.039 198.73Z" />
    </svg>
  );
}
