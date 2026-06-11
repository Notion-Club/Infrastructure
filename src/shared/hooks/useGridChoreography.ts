import { useCallback, useEffect, useRef } from 'react';

/**
 * Chorégraphie de grille filtrable — FLIP + transition d'onglet directionnelle.
 *
 * L'API est **impérative** : le composant appelle `animateTo(visibleIds, opts)`
 * depuis ses handlers (recherche, clic d'onglet) et `reveal()` pour l'apparition
 * initiale. Le hook ne pilote PAS le rendu React — toutes les cartes restent
 * montées en permanence, le hook gère leur visibilité via la classe `.is-hidden`
 * et anime les transforms en direct sur le DOM (refs).
 *
 * Chaque carte doit :
 *   - être montée en permanence (jamais de rendu conditionnel `{visible && …}`),
 *   - porter `data-card-id="<id unique>"`,
 *   - laisser le hook seul maître de la classe `.is-hidden` (ne pas la passer
 *     en `className` côté React, sinon la réconciliation écrase le hook).
 *
 * Le conteneur passé en ref DOIT être `position: relative` (les cartes en
 * sortie y sont ancrées en `position: absolute`).
 */

type Mode = 'reflow' | 'tab';

interface AnimateOptions {
  mode?: Mode;
  /** Sens d'entrée/sortie en mode `tab` : +1 = depuis la droite, -1 = depuis la gauche. */
  direction?: 1 | -1;
}

const SLIDE = 42; // px — glissement latéral en mode onglet
const CLEANUP_MS = 680; // > durée max d'une jambe (enter-dur + stagger max)

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function relRect(el: HTMLElement, base: DOMRect): Rect {
  const r = el.getBoundingClientRect();
  return { x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height };
}

/** Stagger plafonné : `i * step` borné à `max`. */
const stag = (i: number, max: number, step: number): number => Math.min(i * step, max);

/** Purge les styles inline posés pendant l'animation. */
function clearInline(el: HTMLElement): void {
  el.style.cssText = '';
}

export function useGridChoreography(containerRef: React.RefObject<HTMLElement | null>) {
  const animating = useRef(false);
  const pending = useRef<{ ids: Set<string>; opts: AnimateOptions } | null>(null);
  const cleanupTimer = useRef<number | null>(null);
  const reduced = useRef(false);
  // Pointe toujours sur le dernier `run` — casse la récursion run ↔ finish
  // sans recréer les callbacks exposés à chaque rendu.
  const runRef = useRef<(ids: Set<string>, opts: AnimateOptions) => void>(() => {});

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const finish = useCallback(() => {
    animating.current = false;
    const p = pending.current;
    if (p) {
      pending.current = null;
      runRef.current(p.ids, p.opts);
    }
  }, []);

  const run = useCallback(
    (visibleIds: Set<string>, opts: AnimateOptions) => {
      const container = containerRef.current;
      if (!container) return;

      const mode: Mode = opts.mode ?? 'reflow';
      const dir: 1 | -1 = opts.direction ?? 1;

      const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-card-id]'));
      const idOf = (el: HTMLElement) => el.dataset.cardId ?? '';
      const base = container.getBoundingClientRect();

      // FIRST — positions des cartes actuellement visibles
      const first = new Map<HTMLElement, Rect>();
      for (const el of cards) {
        if (!el.classList.contains('is-hidden') && el.dataset.exiting !== 'true') {
          first.set(el, relRect(el, base));
        }
      }

      // Classification : survivors / entering / exiting
      const survivors: HTMLElement[] = [];
      const entering: HTMLElement[] = [];
      const exiting: HTMLElement[] = [];
      for (const el of cards) {
        const show = visibleIds.has(idOf(el));
        const was = first.has(el);
        if (show && was) survivors.push(el);
        else if (show && !was) entering.push(el);
        else if (!show && was) exiting.push(el);
      }

      // Rien à animer (ensemble visible inchangé)
      if (entering.length === 0 && exiting.length === 0) {
        finish();
        return;
      }

      // prefers-reduced-motion → bascule instantanée
      if (reduced.current) {
        for (const el of cards) el.classList.toggle('is-hidden', !visibleIds.has(idOf(el)));
        finish();
        return;
      }

      animating.current = true;

      // EXIT — sortir du flux à la position First, animer en fantôme
      for (const el of exiting) {
        const r = first.get(el)!;
        el.dataset.exiting = 'true';
        Object.assign(el.style, {
          position: 'absolute',
          left: `${r.x}px`,
          top: `${r.y}px`,
          width: `${r.w}px`,
          height: `${r.h}px`,
          margin: '0',
          zIndex: '2',
          pointerEvents: 'none',
          transition: 'none',
          transform: 'translateZ(0)',
        });
      }

      // ENTER — pré-état (invisible), différent selon le mode
      for (const el of entering) {
        el.classList.remove('is-hidden');
        el.style.transition = 'none';
        el.style.opacity = '0';
        if (mode === 'tab') {
          el.style.transform = `translateX(${dir * SLIDE}px) scale(.985)`;
          el.style.filter = 'blur(2px)';
        } else {
          el.style.transform = 'scale(.97) translateY(6px)';
          el.style.filter = 'blur(4px)';
        }
      }

      // LAST — remesurer les survivors dans leurs nouveaux emplacements
      const base2 = container.getBoundingClientRect();
      const last = new Map<HTMLElement, Rect>();
      for (const el of survivors) last.set(el, relRect(el, base2));

      // INVERT — état de départ des survivors selon le mode.
      // - reflow : FLIP (on les renvoie à leur ancienne place, puis ils glissent).
      // - tab : panneau horizontal — pas de FLIP vertical, ils entrent depuis le
      //   côté `dir` comme le reste du nouveau set (évite tout saut vertical).
      for (const el of survivors) {
        el.style.transition = 'none';
        if (mode === 'tab') {
          el.style.transform = `translateX(${dir * SLIDE}px)`;
        } else {
          const a = first.get(el)!;
          const b = last.get(el)!;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          el.style.transform = dx || dy ? `translate(${dx}px,${dy}px)` : 'translateZ(0)';
        }
      }

      // Cascade en ordre de lecture (haut → bas, gauche → droite)
      const order = survivors
        .map((el) => ({ el, k: last.get(el)!.y * 1000 + last.get(el)!.x }))
        .sort((p, n) => p.k - n.k);

      // PLAY — double rAF pour committer l'état inversé avant de transitionner
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          order.forEach(({ el }, i) => {
            if (mode === 'tab') {
              // Glisse horizontalement vers sa place, en cadence avec les entrants.
              const d = stag(i, 180, 22);
              el.style.transition = `transform var(--enter-dur) var(--ease-back) ${d}ms`;
            } else {
              el.style.transition = `transform var(--reflow-dur) var(--ease-fluid)`;
              el.style.transitionDelay = `${stag(i, 70, 7)}ms`;
            }
            el.style.transform = 'translateZ(0)';
          });

          entering.forEach((el, i) => {
            if (mode === 'tab') {
              const d = stag(i, 180, 22);
              el.style.transition =
                `opacity var(--enter-dur) var(--ease-out) ${d}ms,` +
                `transform var(--enter-dur) var(--ease-back) ${d}ms,` +
                `filter var(--enter-dur) var(--ease-out) ${d}ms`;
            } else {
              const d = 110 + stag(i, 70, 14);
              el.style.transition =
                `opacity var(--enter-dur) var(--ease-out) ${d}ms,` +
                `transform var(--enter-dur) var(--ease-out) ${d}ms,` +
                `filter var(--enter-dur) var(--ease-out) ${d}ms`;
            }
            el.style.opacity = '1';
            el.style.transform = 'translateZ(0)';
            el.style.filter = 'blur(0px)';
          });

          exiting.forEach((el) => {
            el.style.transition =
              `opacity var(--exit-dur) var(--ease-out),` +
              `transform var(--exit-dur) var(--ease-in),` +
              `filter var(--exit-dur) var(--ease-out)`;
            el.style.opacity = '0';
            el.style.transform =
              mode === 'tab' ? `translateX(${-dir * SLIDE}px) scale(.985)` : 'scale(.95)';
            el.style.filter = mode === 'tab' ? 'blur(2px)' : 'blur(6px)';
          });
        }),
      );

      // Nettoyage des styles inline après la fin
      if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
      cleanupTimer.current = window.setTimeout(() => {
        survivors.forEach(clearInline);
        entering.forEach(clearInline);
        exiting.forEach((el) => {
          el.classList.add('is-hidden');
          clearInline(el);
          el.dataset.exiting = 'false';
        });
        finish();
      }, CLEANUP_MS);
    },
    [containerRef, finish],
  );

  // Garde `runRef` aligné sur le dernier `run`.
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  /** À appeler depuis les handlers (recherche, clic onglet). */
  const animateTo = useCallback(
    (visibleIds: Set<string>, opts: AnimateOptions = {}) => {
      if (animating.current) {
        pending.current = { ids: visibleIds, opts };
        return;
      }
      run(visibleIds, opts);
    },
    [run],
  );

  /** Apparition initiale (cascade) — joue sur les cartes actuellement visibles. */
  const reveal = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    if (reduced.current) return;
    const cards = Array.from(container.querySelectorAll<HTMLElement>('[data-card-id]')).filter(
      // Exclut les cartes masquées ET celle en cours de morph (shared-element
      // view transition, marquée `data-vt-hero`) : la ré-animer en cascade la
      // ferait repartir d'opacity 0 pendant que l'encadré de la page détail se
      // referme dessus au retour → le morph atterrirait sur une carte invisible.
      (el) => !el.classList.contains('is-hidden') && !el.querySelector('[data-vt-hero]'),
    );
    for (const el of cards) {
      el.style.transition = 'none';
      el.style.opacity = '0';
      el.style.transform = 'scale(.97) translateY(8px)';
      el.style.filter = 'blur(4px)';
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        cards.forEach((el, i) => {
          const d = Math.min(i * 26, 440);
          el.style.transition =
            `opacity 520ms var(--ease-out) ${d}ms,` +
            `transform 560ms var(--ease-out) ${d}ms,` +
            `filter 520ms var(--ease-out) ${d}ms`;
          el.style.opacity = '1';
          el.style.transform = 'translateZ(0)';
          el.style.filter = 'blur(0px)';
        });
        window.setTimeout(() => cards.forEach(clearInline), 1200);
      }),
    );
  }, [containerRef]);

  // Purge le timer de nettoyage au démontage.
  useEffect(
    () => () => {
      if (cleanupTimer.current) clearTimeout(cleanupTimer.current);
    },
    [],
  );

  return { animateTo, reveal };
}
