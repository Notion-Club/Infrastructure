import { Star } from "lucide-react";
import { BrandPill } from "./BrandPill";

const BULLETS = [
  "Accès à la formation complète",
  "Communauté de membres actifs",
  "Calls de coaching personnalisés",
];

export function BrandingPanel() {
  return (
    <aside className="relative hidden h-full flex-col justify-center gap-10 px-12 py-16 md:flex">
      <BrandPill className="self-start" />

      <div className="flex flex-col gap-6">
        <h2 className="text-[clamp(28px,3.5vw,42px)] font-bold leading-[1.05] tracking-[-0.025em] text-[var(--color-text-primary)]">
          Maîtrise Notion.
          <br />
          Transforme ton business.
        </h2>

        <ul className="flex flex-col gap-3">
          {BULLETS.map((bullet) => (
            <li
              key={bullet}
              className="flex items-center gap-3 text-[15px] text-[var(--color-text-secondary)]"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full bg-[var(--color-brand)]"
              />
              {bullet}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2 text-[14px] text-[var(--color-text-muted)]">
        <span className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className="size-4 fill-[#facc15] text-[#facc15]"
              strokeWidth={1.5}
            />
          ))}
        </span>
        Rejoint par +200 membres
      </div>
    </aside>
  );
}
