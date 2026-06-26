// Easing spring façon iOS — généré par PHYSIQUE de ressort, pas inventé.
//
// Méthode : réponse indicielle d'un ressort sous-amorti (paramétrage Apple
// « response + damping ratio »), échantillonnée en `linear()` à la manière du
// linear-easing-generator de Jake Archibald.
//   → https://linear-easing-generator.netlify.app
//
// Paramètres : response = 0.4 s, damping ratio ζ = 0.8
//   ωₙ = 2π / 0.4         = 15.708 rad/s   (pulsation propre)
//   ω_d = ωₙ·√(1−ζ²)      = 9.425 rad/s    (pulsation amortie)
//   x(t) = 1 − e^(−ζωₙt)·[cos(ω_d t) + (ζωₙ/ω_d)·sin(ω_d t)]
//
// Profil : léger overshoot ≈ 1.52 % au pic (~62 % du timeline), stabilisation
// ≈ 540 ms → c'est la durée du morph. Dernier point épinglé à 1 (atterrissage
// net). À utiliser pour le conteneur (transform + border-radius) et le titre.
export const SPRING_EASING =
  'linear(0 0%, 0.0445 3.8%, 0.1492 7.7%, 0.2811 11.5%, 0.4183 15.4%, 0.5475 19.2%, ' +
  '0.6613 23.1%, 0.7566 26.9%, 0.8331 30.8%, 0.8923 34.6%, 0.9362 38.5%, 0.9676 42.3%, ' +
  '0.9888 46.2%, 1.0024 50%, 1.0102 53.8%, 1.014 57.7%, 1.0152 61.5%, 1.0146 65.4%, ' +
  '1.013 69.2%, 1.0111 73.1%, 1.009 76.9%, 1.007 80.8%, 1.0053 84.6%, 1.0038 88.5%, ' +
  '1.0026 92.3%, 1.0017 96.2%, 1 100%)';

export const SPRING_DURATION = 540;

// Easing doux pour les cross-fades (sortie carte / entrée encadré / scrim) —
// pas de spring sur l'opacité, on garde une décélération simple.
export const FADE_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';
