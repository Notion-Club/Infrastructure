import { Button } from "@/shared/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Notion Club Infra</h1>
        <p className="max-w-md text-muted-foreground">
          Plateforme en construction. Architecture modulaire, shadcn/ui, Supabase.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button>Default</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
    </main>
  );
}
