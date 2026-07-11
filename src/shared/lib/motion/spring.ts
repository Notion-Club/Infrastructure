// Easing — ressort CRITIQUE (ζ = 1), généré par PHYSIQUE, pas inventé.
//
// Source unique partagée par les moteurs de morph (ressources ET community) —
// avant, cette courbe était copiée verbatim dans chaque module à cause de la
// règle d'isolation ; elle vit désormais dans @/shared, que tout module peut
// importer.
//
// Réponse indicielle d'un ressort critiquement amorti : décélération douce et
// MONOTONE, ZÉRO overshoot → l'élément ne « rebondit » jamais et se cale net sur
// sa cible. Échantillonné en `linear()` à la manière du linear-easing-generator
// de Jake Archibald → https://linear-easing-generator.netlify.app
//
//   x(t) = 1 − e^(−ωₙt)·(1 + ωₙt),   ωₙ = 16 rad/s
//   stabilisation ≈ 482 ms → durée du morph.
//
// À utiliser pour le conteneur (transform + border-radius) ET tout transport de
// contenu (titre, description, tags) → tout s'arrête ensemble, sans rebond.
export const SPRING_EASING =
  'linear(0 0%, 0.0418 4.2%, 0.1361 8.3%, 0.251 12.5%, 0.368 16.7%, 0.4772 20.8%, ' +
  '0.5742 25%, 0.6573 29.2%, 0.7269 33.3%, 0.7841 37.5%, 0.8305 41.7%, 0.8677 45.8%, ' +
  '0.8973 50%, 0.9206 54.2%, 0.9388 58.3%, 0.9531 62.5%, 0.9641 66.7%, 0.9726 70.8%, ' +
  '0.9791 75%, 0.9841 79.2%, 0.988 83.3%, 0.9909 87.5%, 0.9931 91.7%, 0.9948 95.8%, 1 100%)';

export const SPRING_DURATION = 482;
