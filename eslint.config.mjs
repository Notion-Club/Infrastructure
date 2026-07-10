import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Liste exhaustive des modules métier. Toute nouvelle brique doit être ajoutée ici
// pour que les règles d'isolation s'appliquent. Cf. CONVENTIONS.md.
const MODULES = [
  "auth",
  "formation",
  "community",
  "notion-sync",
  "coaching",
  "onboarding",
  "settings",
  "ressources",
  "admin",
];

// Pour un module donné, génère une override ESLint qui interdit les imports
// vers les autres modules. Autorisés depuis un module : son propre code,
// `@/shared/*`, `@/app/*` (rare), et tout package externe.
function crossModuleBoundary(currentModule) {
  const forbidden = MODULES.filter((m) => m !== currentModule).flatMap((m) => [
    `@/modules/${m}`,
    `@/modules/${m}/*`,
  ]);

  return {
    files: [`src/modules/${currentModule}/**/*.{ts,tsx,js,jsx,mjs,cjs}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: forbidden,
              message: `Import inter-modules interdit : src/modules/${currentModule} ne peut pas importer d'un autre module métier. Déplace le code partagé dans @/shared/* ou orchestre via une couche supérieure (app/server action).`,
            },
          ],
        },
      ],
    },
  };
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Une override par module — chaque fichier d'un module n'est soumis qu'à
  // sa propre règle (les `files` patterns ne se chevauchent pas).
  ...MODULES.map(crossModuleBoundary),
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Composants shadcn/ui : code copié-collé, on ne le lint pas strictement.
    "src/shared/components/ui/**",
  ]),
]);

export default eslintConfig;
