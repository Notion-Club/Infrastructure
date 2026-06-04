import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Notion Club",
  description:
    "Politique de confidentialité de Notion Club : quelles données nous collectons, pourquoi, et comment vous pouvez les contrôler.",
};

// Page Privacy Policy — prérequis OPS-22 (brand verification Google OAuth).
// Texte brut sans design avancé — Théo restylisera côté front si besoin.
// Conforme RGPD + scopes Google OAuth déclarés (email, profile, openid).
export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px 96px",
        fontFamily: "var(--font-sf-pro, -apple-system, BlinkMacSystemFont, sans-serif)",
        lineHeight: 1.6,
        color: "#0f172a",
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Politique de confidentialité
      </h1>
      <p style={{ color: "#64748b", marginBottom: 32, fontSize: 14 }}>
        Dernière mise à jour : 4 juin 2026
      </p>

      <Section title="1. Qui sommes-nous ?">
        <p>
          Notion Club est un programme de formation en ligne dédié à
          l'écosystème Notion. La plateforme est exploitée par Théo Gouman,
          micro-entrepreneur, accessible à l'adresse{" "}
          <a href="https://app.notionclub.fr">app.notionclub.fr</a>.
        </p>
        <p>
          Pour toute question relative à cette politique, vous pouvez nous
          contacter à <a href="mailto:theo@gouman.fr">theo@gouman.fr</a>.
        </p>
      </Section>

      <Section title="2. Données que nous collectons">
        <p>
          Lorsque vous utilisez Notion Club, nous collectons les données
          suivantes :
        </p>
        <ul>
          <li>
            <strong>Données de compte</strong> : adresse e-mail, prénom, nom,
            nom d'affichage (pseudo), photo de profil (facultative), numéro
            de téléphone (facultatif), biographie (facultative).
          </li>
          <li>
            <strong>Données d'authentification</strong> : mot de passe haché
            (jamais stocké en clair), ou identifiants OAuth Google si vous
            vous connectez via « Continuer avec Google ».
          </li>
          <li>
            <strong>Contenu généré</strong> : messages échangés en
            communauté (publications, commentaires, messages privés),
            réactions, pièces jointes que vous chargez.
          </li>
          <li>
            <strong>Données de progression</strong> : leçons consultées,
            modules terminés, sessions de coaching planifiées.
          </li>
          <li>
            <strong>Données techniques</strong> : adresse IP (pour la
            sécurité et la prévention d'abus), user agent (navigateur,
            système), journaux d'erreurs anonymisés.
          </li>
        </ul>
      </Section>

      <Section title="3. Connexion via Google (OAuth)">
        <p>
          Si vous choisissez de vous connecter avec votre compte Google,
          nous demandons uniquement les permissions suivantes (« scopes »
          OAuth) :
        </p>
        <ul>
          <li>
            <code>openid</code> — pour identifier votre compte Google de
            manière unique.
          </li>
          <li>
            <code>email</code> — pour récupérer votre adresse e-mail
            principale et l'associer à votre compte Notion Club.
          </li>
          <li>
            <code>profile</code> — pour récupérer votre nom et, le cas
            échéant, votre photo de profil Google (qui n'est jamais
            stockée sans votre consentement explicite).
          </li>
        </ul>
        <p>
          Nous ne demandons <strong>aucun accès</strong> à Gmail, Google
          Drive, Google Calendar ou à toute autre API sensible. Vous pouvez
          révoquer l'accès à tout moment depuis votre{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
          >
            compte Google
          </a>
          .
        </p>
      </Section>

      <Section title="4. Pourquoi nous traitons vos données">
        <p>
          Les données sont traitées sur la base des fondements légaux
          suivants :
        </p>
        <ul>
          <li>
            <strong>Exécution du contrat</strong> : créer votre compte,
            vous permettre d'accéder aux contenus de formation, gérer les
            sessions de coaching, traiter les paiements.
          </li>
          <li>
            <strong>Intérêt légitime</strong> : assurer la sécurité de la
            plateforme, prévenir les abus, améliorer le produit.
          </li>
          <li>
            <strong>Consentement</strong> : envoi de notifications par
            e-mail (vous pouvez vous désinscrire à tout moment depuis vos
            réglages).
          </li>
        </ul>
      </Section>

      <Section title="5. Partage avec des tiers">
        <p>
          Nous utilisons les services tiers suivants, qui peuvent traiter
          certaines de vos données pour notre compte :
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> (hébergement de la base de données et
            de l'authentification) — Union européenne.
          </li>
          <li>
            <strong>Vercel</strong> (hébergement de l'application web).
          </li>
          <li>
            <strong>Resend</strong> (envoi d'e-mails transactionnels et de
            notifications).
          </li>
          <li>
            <strong>Stripe</strong> (traitement des paiements ; nous
            n'accédons jamais à vos données bancaires).
          </li>
          <li>
            <strong>Google</strong> (uniquement si vous vous connectez via
            OAuth Google).
          </li>
        </ul>
        <p>
          Aucune donnée n'est revendue à des tiers à des fins commerciales.
        </p>
      </Section>

      <Section title="6. Conservation des données">
        <p>
          Vos données sont conservées tant que votre compte est actif. Si
          vous supprimez votre compte depuis vos réglages, l'ensemble de
          vos données personnelles est anonymisé sous 30 jours, à
          l'exception des données légales que nous sommes tenus de
          conserver (factures, journaux de sécurité) selon les durées
          imposées par la loi française.
        </p>
      </Section>

      <Section title="7. Vos droits (RGPD)">
        <p>
          Conformément au Règlement Général sur la Protection des Données,
          vous disposez des droits suivants :
        </p>
        <ul>
          <li>Droit d'accès à vos données.</li>
          <li>Droit de rectification.</li>
          <li>Droit à l'effacement (suppression du compte).</li>
          <li>Droit à la limitation du traitement.</li>
          <li>Droit à la portabilité.</li>
          <li>Droit d'opposition.</li>
          <li>
            Droit d'introduire une réclamation auprès de la CNIL
            (cnil.fr).
          </li>
        </ul>
        <p>
          Pour exercer ces droits, écrivez-nous à{" "}
          <a href="mailto:theo@gouman.fr">theo@gouman.fr</a>.
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          Vos données sont chiffrées en transit (HTTPS / TLS 1.3) et au
          repos (chiffrement disque PostgreSQL). Les mots de passe sont
          hachés via bcrypt. L'accès aux données de production est
          strictement limité aux opérateurs autorisés.
        </p>
      </Section>

      <Section title="9. Cookies">
        <p>
          Nous utilisons uniquement des cookies strictement nécessaires au
          fonctionnement de la plateforme (session d'authentification,
          préférence d'apparence). Aucun cookie publicitaire ou de
          tracking tiers n'est déposé.
        </p>
      </Section>

      <Section title="10. Modifications">
        <p>
          Cette politique peut être mise à jour pour refléter les
          évolutions du service ou les évolutions légales. Les
          modifications substantielles seront notifiées par e-mail aux
          utilisateurs actifs au moins 15 jours avant leur entrée en
          vigueur.
        </p>
      </Section>

      <footer style={{ marginTop: 64, fontSize: 13, color: "#94a3b8" }}>
        <p>
          <a href="/" style={{ color: "#e0625a" }}>
            ← Retour à l'accueil
          </a>
          {" · "}
          <a href="/terms" style={{ color: "#e0625a" }}>
            Conditions d'utilisation
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
