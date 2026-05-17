import { cn } from "@/shared/lib/utils";

export function BrandPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full bg-black py-2 pr-2.5 pl-4 text-[13px] font-semibold tracking-tight text-white",
        className,
      )}
    >
      Notion Club
      <span className="nc-blink-dot" aria-hidden />
    </span>
  );
}
