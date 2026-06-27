// E2E — mécanique du morph /Ressources (overlay client).
//
// Exerce le CODE RÉEL de l'overlay (ResourceMorphOverlay + cartes) via la route
// dev-only /lab/morph montée sur données mockées → zéro dépendance Notion/auth.
// C'est le filet qui PROUVE la fiabilité (ouverture/fermeture multi-cartes, zéro
// résidu, focus-trap, focus restitué, verrou, resize) là où la preview est
// inaccessible.
//
// Lancement : `node e2e/run-morph.mjs`  (ou `npm run e2e:morph`).
// Le script démarre `next dev` sur un port dédié, joue les assertions en
// chromium headless, puis nettoie. Sort 1 si une assertion échoue.

import { spawn, execSync } from 'node:child_process';

// Playwright n'est pas une dépendance déclarée (cf. .github/workflows/e2e-morph.yml).
// Import dynamique avec message clair si absent en local.
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error(
    'Playwright manquant. Installe-le :\n  npm install --no-save playwright && npx playwright install chromium',
  );
  process.exit(2);
}

const PORT = 3123;
const BASE = `http://127.0.0.1:${PORT}`;
const URL = `${BASE}/lab/morph`;

const HREF = {
  resOpen: '/ressources/ressource/res-open',
  resLocked: '/ressources/ressource/res-locked',
  tplOpen: '/ressources/template/tpl-open',
};

const results = [];
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
async function check(name, fn) {
  try {
    await fn();
    results.push(true);
    console.log('  ✓', name);
  } catch (e) {
    results.push(false);
    console.log('  ✗', name, '—', e.message);
  }
}

async function waitServer(timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch {
      /* pas encore prêt */
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error('next dev n’a pas répondu sur ' + URL);
}

// ── Helpers page ────────────────────────────────────────────────────────────
const dialog = (page) => page.locator('[role="dialog"]');
const open = (page, href) => page.click(`a[href="${href}"]`);
const waitOpen = (page) => page.waitForSelector('[role="dialog"]', { state: 'attached', timeout: 6000 });
const waitClosed = (page) => page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 6000 });
const title = (page) => page.getAttribute('[role="dialog"]', 'aria-label');
const focusInDialog = (page) =>
  page.waitForFunction(() => {
    const d = document.querySelector('[role="dialog"]');
    return !!d && d.contains(document.activeElement);
  }, { timeout: 6000 });
// Attend la fin du morph d'ouverture (la croix passe interactive → opacity 1).
const waitInteractive = (page) =>
  page.waitForFunction(() => {
    const b = document.querySelector('button[aria-label="Fermer"]');
    return !!b && getComputedStyle(b).opacity === '1';
  }, { timeout: 6000 });

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log('  [console.error]', m.text());
  });
  await page.goto(URL, { waitUntil: 'load' });
  // Attend l'hydratation (handlers attachés) avant tout clic.
  await page.waitForFunction(() => document.documentElement.dataset.morphReady === '1', { timeout: 20000 });

  // 1 — Ouverture d'une ressource : dialogue + titre + contenu réel.
  await check('ouverture ressource → dialogue avec titre + contenu', async () => {
    await open(page, HREF.resOpen);
    await waitOpen(page);
    assert((await dialog(page).count()) === 1, 'un seul dialogue attendu');
    assert((await title(page)) === 'Process de closing en 5 étapes', 'titre du dialogue incorrect');
    await page.waitForFunction(() => document.body.innerText.includes('Préparer le terrain'), { timeout: 6000 });
  });

  // 2 — Le focus entre dans le dialogue à l'ouverture (a11y).
  await check('focus dans le dialogue à l’ouverture', async () => {
    await focusInDialog(page);
  });

  // 3 — Focus-trap : Tab reste dans le dialogue.
  await check('focus-trap : Tab reste dans le dialogue', async () => {
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return !!d && d.contains(document.activeElement);
      });
      assert(inside, `focus sorti du dialogue après ${i + 1} Tab`);
    }
  });

  // 4 — Fermeture (Échap) : zéro résidu.
  await check('fermeture Échap → zéro résidu', async () => {
    await page.keyboard.press('Escape');
    await waitClosed(page);
    assert((await dialog(page).count()) === 0, 'résidu de dialogue après fermeture');
  });

  // 5 — Multi-cartes : ouvrir une 2ᵉ carte après fermeture → aucun résidu de la 1ʳᵉ.
  await check('multi-cartes : 2ᵉ ouverture propre (zéro résidu)', async () => {
    await open(page, HREF.resOpen);
    await waitOpen(page);
    await page.keyboard.press('Escape');
    await waitClosed(page);
    await open(page, HREF.tplOpen);
    await waitOpen(page);
    assert((await dialog(page).count()) === 1, 'plus d’un dialogue (résidu)');
    assert((await title(page)) === 'CRM Notion clé en main', 'titre de la 2ᵉ carte incorrect');
    await page.waitForFunction(() => document.body.innerText.includes('Dupliquer'), { timeout: 6000 });
    await page.keyboard.press('Escape');
    await waitClosed(page);
  });

  // 6 — Verrou d'accès : ressource Accompagnement → CapabilityLock, pas de contenu.
  await check('verrou d’accès → CapabilityLock, pas de contenu', async () => {
    await open(page, HREF.resLocked);
    await waitOpen(page);
    assert((await title(page)) === 'Système de pilotage avancé', 'titre verrou incorrect');
    const txt = await page.evaluate(() => document.querySelector('[role="dialog"]')?.innerText || '');
    assert(/réservé aux membres Accompagnement/.test(txt), 'message de verrou absent');
    assert(!/Contenu confidentiel/.test(txt), 'le contenu verrouillé ne doit pas être rendu');
    await page.keyboard.press('Escape');
    await waitClosed(page);
  });

  // 7 — Resize pendant l'ouverture : pas de crash, dialogue toujours présent et visible.
  await check('resize pendant l’ouverture → dialogue stable', async () => {
    await open(page, HREF.resOpen);
    await waitOpen(page);
    await page.setViewportSize({ width: 480, height: 850 });
    await page.waitForTimeout(150);
    assert((await dialog(page).count()) === 1, 'dialogue perdu au resize');
    const box = await dialog(page).boundingBox();
    assert(box && box.width > 0 && box.height > 0, 'dialogue non visible après resize');
    await page.keyboard.press('Escape');
    await waitClosed(page);
  });

  // 8 — Scroll préservé à la fermeture (bug : le scroll sautait en haut puis
  //     revenait). On scrolle, on ouvre, on ferme → la position ne doit PAS bouger.
  await check('scroll préservé à l’ouverture/fermeture', async () => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.evaluate(() => window.scrollTo(0, 250));
    await page.waitForFunction(() => window.scrollY === 250, { timeout: 4000 });
    await open(page, HREF.resOpen);
    await waitOpen(page);
    const yOpen = await page.evaluate(() => window.scrollY);
    assert(yOpen === 250, `le scroll a bougé à l’ouverture (${yOpen} ≠ 250)`);
    await page.keyboard.press('Escape');
    await waitClosed(page);
    const yClose = await page.evaluate(() => window.scrollY);
    assert(yClose === 250, `le scroll a sauté à la fermeture (${yClose} ≠ 250)`);
  });

  // 9 — Ouverture CLAVIER : le focus est restitué à la carte à la fermeture.
  await check('clavier : focus restitué à la carte (Entrée → Échap)', async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.focus(`a[href="${HREF.resOpen}"]`);
    await page.keyboard.press('Enter');
    await waitOpen(page);
    await page.keyboard.press('Escape');
    await waitClosed(page);
    const onTrigger = await page.evaluate(
      (href) => document.activeElement?.getAttribute('href') === href,
      HREF.resOpen,
    );
    assert(onTrigger, 'le focus n’est pas revenu sur la carte après ouverture clavier');
  });

  // 10 — Scroll-document : contenu défilable, TITRE et CROIX ancrés à la carte
  //      (ils DÉFILENT avec elle — visibles en haut seulement).
  await check('scroll-document : titre + croix défilent avec la carte, contenu défilable', async () => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await open(page, HREF.resOpen);
    await waitOpen(page);
    await waitInteractive(page);

    const m = () =>
      page.evaluate(() => {
        const t = document.querySelector('[role="dialog"] h1');
        const b = document.querySelector('button[aria-label="Fermer"]');
        const s = document.querySelector('[data-testid="morph-scroll"]');
        return {
          titleTop: t ? Math.round(t.getBoundingClientRect().top) : null,
          closeTop: b ? Math.round(b.getBoundingClientRect().top) : null,
          scrollTop: s ? s.scrollTop : null,
          scrollable: s ? s.scrollHeight > s.clientHeight + 50 : false,
        };
      });

    const before = await m();
    assert(before.scrollable, 'le conteneur de l’encadré n’est pas défilable (contenu trop court ?)');

    await page.evaluate(() => {
      document.querySelector('[data-testid="morph-scroll"]')?.scrollTo(0, 300);
    });
    await page.waitForFunction(
      () => (document.querySelector('[data-testid="morph-scroll"]')?.scrollTop ?? 0) >= 290,
      { timeout: 3000 },
    );
    const after = await m();

    assert(after.scrollTop >= 290, 'le conteneur n’a pas défilé');
    assert(after.titleTop < before.titleTop - 100, `le titre n’a pas défilé (${before.titleTop} → ${after.titleTop})`);
    assert(after.closeTop < before.closeTop - 100, `la croix n’a pas défilé avec la carte (${before.closeTop} → ${after.closeTop})`);

    await page.keyboard.press('Escape');
    await waitClosed(page);
  });

  await browser.close();

  const passed = results.filter(Boolean).length;
  const total = results.length;
  console.log(`\n${passed}/${total} assertions OK`);
  return passed === total;
}

// Env injecté au build ET au serveur :
// • NOTION_API_TOKEN factice → la grille /ressources fetch Notion en 401 et
//   retombe sur [] (pas de throw) → le build passe sans le vrai token.
// • NEXT_PUBLIC_SUPABASE_* factices → le proxy (src/proxy.ts) construit son
//   client sans 500 ; getUser() échoue sans lever.
// On teste un build de PRODUCTION (next start), pas `next dev` : l'hydratation y
// est fiable et indépendante du HMR (le dev ne s'hydratait pas sous le proxy).
const NEXT_ENV = {
  ...process.env,
  BROWSER: 'none',
  NOTION_API_TOKEN: process.env.NOTION_API_TOKEN || 'e2e-dummy-notion',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'e2e-dummy-anon-key',
};

function buildOnce() {
  return new Promise((resolve, reject) => {
    const b = spawn('./node_modules/.bin/next', ['build'], { cwd: process.cwd(), env: NEXT_ENV, stdio: 'inherit' });
    b.on('exit', (c) => (c === 0 ? resolve() : reject(new Error(`next build a échoué (code ${c})`))));
  });
}

// ── Orchestration : build prod → next start → assertions → nettoyage ─────────
let server;
let code = 1;
try {
  // Libère le port au cas où un serveur d'un run précédent y traîne (sinon
  // waitServer toperait l'ancien serveur servant des chunks périmés → 500).
  try {
    execSync(`lsof -ti tcp:${PORT} | xargs kill -9`, { stdio: 'ignore' });
  } catch {
    /* rien à tuer, ou lsof absent (CI) → port déjà libre */
  }
  if (process.env.E2E_SKIP_BUILD !== '1') {
    console.log('→ build de production (env factice)…');
    await buildOnce();
  }
  console.log('→ démarrage de `next start` sur le port', PORT, '…');
  server = spawn('./node_modules/.bin/next', ['start', '-p', String(PORT)], {
    cwd: process.cwd(),
    env: NEXT_ENV,
    stdio: 'ignore',
    detached: true,
  });
  await waitServer();
  console.log('→ serveur prêt, lancement des assertions…\n');
  const ok = await run();
  code = ok ? 0 : 1;
} catch (e) {
  console.error('ERREUR e2e :', e.message);
  code = 1;
} finally {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      try {
        server.kill('SIGTERM');
      } catch {
        /* noop */
      }
    }
  }
}
process.exit(code);
