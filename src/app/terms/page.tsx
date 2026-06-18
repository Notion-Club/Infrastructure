import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Conditions d'utilisation — Notion Club",
  description:
    "Conditions générales d'utilisation de la plateforme Notion Club.",
};

// Page Terms of Service — prérequis OPS-22 (brand verification Google OAuth).
// Texte brut sans design avancé — Théo restylisera côté front si besoin.
export default function TermsPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px 96px",
        fontFamily: "var(--font-sf-pro-display, -apple-system, BlinkMacSystemFont, sans-serif)",
        lineHeight: 1.6,
        color: "#0f172a",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Conditions d'utilisation
      </h1>
      <p style={{ color: "#64748b", marginBottom: 32, fontSize: 14 }}>
        Dernière mise à jour : 4 juin 2026
      </p>

      <Section title="1. Objet">
        <p>
          Les présentes conditions générales d'utilisation (« CGU »)
          régissent l'accès et l'utilisation de la plateforme Notion Club,
          accessible à l'adresse{" "}
          <a href="https://app.notionclub.fr">app.notionclub.fr</a>{" "}
          (ci-après « la Plateforme »).
        </p>
        <p>
          La Plateforme est éditée par Théo Gouman, micro-entrepreneur,
          contactable à{" "}
          <a href="mailto:theo@gouman.fr">theo@gouman.fr</a>.
        </p>
      </Section>

      <Section title="2. Acceptation des CGU">
        <p>
          La création d'un compte sur la Plateforme implique l'acceptation
          pleine et entière des présentes CGU. Si vous n'acceptez pas tout
          ou partie de ces conditions, vous devez renoncer à utiliser la
          Plateforme.
        </p>
      </Section>

      <Section title="3. Création de compte">
        <p>
          L'inscription est ouverte aux personnes physiques majeures.
          Vous vous engagez à fournir des informations exactes et à les
          tenir à jour. Vous êtes seul·e responsable de la confidentialité
          de vos identifiants.
        </p>
        <p>
          Notion Club se réserve le droit de suspendre ou supprimer tout
          compte en cas de violation des présentes CGU, d'usurpation
          d'identité ou de comportement abusif envers d'autres membres.
        </p>
      </Section>

      <Section title="4. Accès aux contenus">
        <p>
          Les contenus de formation, sessions de coaching et ressources de
          la Plateforme sont accessibles selon l'offre souscrite. La
          consultation est strictement personnelle : il est interdit de
          partager ses identifiants, de redistribuer les contenus ou de
          les utiliser à des fins commerciales sans autorisation écrite
          préalable.
        </p>
      </Section>

      <Section title="5. Communauté et messagerie privée">
        <p>
          La Plateforme intègre des espaces de discussion (feed
          communautaire, messages privés). Vous vous engagez à respecter
          les autres membres et à n'y publier aucun contenu :
        </p>
        <ul>
          <li>illicite, diffamatoire, injurieux ou discriminatoire ;</li>
          <li>portant atteinte à la vie privée d'autrui ;</li>
          <li>de nature commerciale non sollicitée (spam, démarchage) ;</li>
          <li>violant des droits de propriété intellectuelle.</li>
        </ul>
        <p>
          Notion Club se réserve le droit de modérer, supprimer ou
          archiver tout contenu contraire à ces règles, sans préavis ni
          indemnité.
        </p>
      </Section>

      <Section title="6. Paiements">
        <p>
          Les abonnements et échéances de paiement sont traités par notre
          prestataire Stripe. Les prix sont indiqués en euros, toutes
          taxes comprises. En cas de non-paiement à l'échéance, l'accès
          aux contenus payants peut être suspendu après un délai de
          relance de 7 jours.
        </p>
      </Section>

      <Section title="7. Propriété intellectuelle">
        <p>
          L'ensemble des contenus pédagogiques (vidéos, textes,
          ressources, templates) reste la propriété exclusive de Notion
          Club. Une licence d'usage personnel non-cessible est concédée à
          l'utilisateur pendant toute la durée de son abonnement.
        </p>
        <p>
          Les contenus publiés par les membres dans la communauté
          (publications, commentaires, fichiers) restent la propriété de
          leurs auteurs, qui accordent à Notion Club une licence
          non-exclusive de stockage et d'affichage aux fins du
          fonctionnement de la Plateforme.
        </p>
      </Section>

      <Section title="8. Limitation de responsabilité">
        <p>
          Notion Club met tout en œuvre pour assurer la disponibilité de
          la Plateforme, sans garantir une absence totale d'interruption.
          Notre responsabilité ne saurait être engagée en cas
          d'indisponibilité due à des opérations de maintenance, des
          dysfonctionnements techniques ou des cas de force majeure.
        </p>
        <p>
          Les contenus pédagogiques et conseils délivrés ont une vocation
          informative. Toute application opérationnelle (création
          d'entreprise, choix d'outils, démarches juridiques) relève de la
          seule responsabilité de l'utilisateur.
        </p>
      </Section>

      <Section title="9. Résiliation">
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis vos
          réglages. La suppression entraîne l'anonymisation de vos données
          personnelles dans un délai de 30 jours, sous réserve des
          obligations légales de conservation. Les paiements déjà
          effectués ne sont pas remboursés sauf disposition contraire
          prévue par la loi (droit de rétractation de 14 jours pour les
          consommateurs, sauf si l'utilisateur a expressément demandé
          l'accès aux contenus dès la souscription).
        </p>
      </Section>

      <Section title="10. Modifications">
        <p>
          Notion Club se réserve le droit de modifier les présentes CGU à
          tout moment. Les utilisateurs seront informés par e-mail au
          moins 15 jours avant l'entrée en vigueur de toute modification
          substantielle. La poursuite de l'utilisation après cette date
          vaut acceptation des nouvelles conditions.
        </p>
      </Section>

      <Section title="11. Droit applicable et juridiction">
        <p>
          Les présentes CGU sont régies par le droit français. En cas de
          litige, et après tentative de résolution amiable, les tribunaux
          français seront seuls compétents.
        </p>
      </Section>

      <footer style={{ marginTop: 64, fontSize: 13, color: "#94a3b8" }}>
        <p>
          <a href="/" style={{ color: "#e0625a" }}>
            ← Retour à l'accueil
          </a>
          {" · "}
          <a href="/privacy" style={{ color: "#e0625a" }}>
            Politique de confidentialité
          </a>
        </p>
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{title}</h2>
      <div style={{ fontSize: 15 }}>{children}</div>
    </section>
  );
}
