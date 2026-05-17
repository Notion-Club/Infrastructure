import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Accueil — Notion Club",
};

const LOGO_SRC =
  "https://res.cloudinary.com/dceobxyts/image/upload/v1777034233/Notion_Club_-_Black_-_Sans_BG_hcvk9k.png";

// Mockup statique — pas d'auth réelle.
// La porte d'entrée (/login → /dashboard) est juste un router.push pour le moment.
// Le branchement Supabase sera fait dans une itération dédiée.
export default function HomePage() {
  return (
    <main className="nc-page-halo relative flex min-h-[100dvh] flex-col">
      <Header />

      <div className="relative z-[1] mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-12 px-6 py-12 md:px-10">
        <section className="flex flex-col gap-3">
          <p className="text-[14px] font-medium text-[var(--color-text-muted)]">
            Bienvenue sur ton espace
          </p>
          <h1 className="text-[clamp(28px,3.5vw,40px)] font-bold leading-tight tracking-[-0.025em] text-[var(--color-text-primary)]">
            Salut Théo 👋
          </h1>
          <p className="max-w-[560px] text-[16px] leading-relaxed text-[var(--color-text-secondary)]">
            Retrouve ici l&apos;ensemble des programmes du Notion Club, ta
            communauté et tes prochains calls de coaching.
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PROGRAMS.map((program) => (
            <ProgramCard key={program.title} {...program} />
          ))}
        </section>
      </div>
    </main>
  );
}

function Header() {
  return (
    <header className="relative z-10 flex items-center justify-between border-b border-[var(--color-border-default)]/60 bg-white/60 px-6 py-4 backdrop-blur md:px-10">
      <Link href="/dashboard" className="flex items-center">
        <Image
          src={LOGO_SRC}
          alt="Notion Club"
          width={120}
          height={40}
          priority
          className="h-9 w-auto"
        />
      </Link>

      <Link
        href="/login"
        className="rounded-full border border-[var(--color-border-default)] bg-white px-4 py-2 text-[14px] font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text-primary)]"
      >
        Se déconnecter
      </Link>
    </header>
  );
}

type Program = {
  title: string;
  description: string;
  status: "available" | "soon";
};

const PROGRAMS: Program[] = [
  {
    title: "Formation Notion",
    description: "Maîtrise Notion de A à Z avec des cas pratiques business.",
    status: "available",
  },
  {
    title: "Communauté",
    description: "Échange avec les autres membres et partage tes setups.",
    status: "available",
  },
  {
    title: "Calls de coaching",
    description: "Réserve un créneau 1:1 avec un expert Notion Club.",
    status: "soon",
  },
];

function ProgramCard({ title, description, status }: Program) {
  return (
    <article className="flex flex-col gap-3 rounded-[var(--nc-radius-md)] border border-[var(--color-border-default)] bg-white p-5 shadow-[var(--nc-shadow-3)] transition-transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--color-text-primary)]">
          {title}
        </h2>
        {status === "soon" && (
          <span className="rounded-full bg-[var(--color-surface-raised)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
            Bientôt
          </span>
        )}
      </div>
      <p className="text-[14px] leading-relaxed text-[var(--color-text-secondary)]">
        {description}
      </p>
    </article>
  );
}
