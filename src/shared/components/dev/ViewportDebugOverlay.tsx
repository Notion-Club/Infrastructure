"use client";

import { useEffect, useRef } from "react";

// ============================================================================
// ViewportDebugOverlay — INSTRUMENTATION TEMPORAIRE (chantier clavier mobile).
//
// But UNIQUE : falsifier l'hypothèse « visualViewport dit la vérité pendant
// que l'ICB (layout viewport) est figé en PWA iOS après fermeture du
// clavier ». Aucun fix ici — lecture seule, affichage brut des métriques.
//
// À RETIRER en fin de chantier (Phase 6) avant toute PR vers main.
//
// Fonctionnement (relevé sur appareil sans rien noter à la main) :
//   • le panneau affiche les valeurs LIVE ;
//   • chaque event viewport est consigné dans un JOURNAL (dédupliqué : une
//     entrée seulement quand les valeurs changent, sinon un compteur) ;
//   • bouton 📌 : insère une MARQUE numérotée dans le journal (à presser aux
//     moments (a)/(b)/(c)/(d) du protocole) ;
//   • bouton 📋 : copie tout le journal dans le presse-papier.
//   Les boutons capturent sur pointerdown + preventDefault : presser 📌
//   pendant la saisie ne vole PAS le focus du champ (le clavier reste ouvert,
//   la mesure (b) reste honnête).
//
// Activation :
//   • FORCE_DEBUG = true sur la branche feature/community-keyboard-viewport :
//     le start_url PWA (/dashboard) perd les query params et le storage d'une
//     web-app iOS est isolé de Safari → un flag d'URL seul serait
//     inatteignable en standalone. La branche ne part jamais en prod avant le
//     retrait de l'overlay, donc l'activation inconditionnelle est sans risque.
//   • Sinon (FORCE_DEBUG = false) : `?vpdebug=1` dans l'URL.
//
// Écritures DOM impératives (textContent), zéro state React : pas de
// re-render à chaque event viewport, et conforme à la règle du repo
// interdisant les setState synchrones dans les effects.
// ============================================================================

const FORCE_DEBUG = true;
const MAX_LOG_ENTRIES = 120;

interface OverlayApi {
  mark: () => void;
  send: () => Promise<void>;
}

export function ViewportDebugOverlay() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLPreElement>(null);
  const btnRowRef = useRef<HTMLDivElement>(null);
  const markBtnRef = useRef<HTMLButtonElement>(null);
  const copyBtnRef = useRef<HTMLButtonElement>(null);
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const apiRef = useRef<OverlayApi | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const panel = panelRef.current;
    const btnRow = btnRowRef.current;
    const markBtn = markBtnRef.current;
    const copyBtn = copyBtnRef.current;
    const fallback = fallbackRef.current;
    if (
      !wrap ||
      !panel ||
      !btnRow ||
      !markBtn ||
      !copyBtn ||
      !fallback ||
      !("visualViewport" in window)
    )
      return;
    const enabled =
      FORCE_DEBUG ||
      new URLSearchParams(window.location.search).get("vpdebug") === "1";
    if (!enabled) return;

    const vv = window.visualViewport;

    // Sondes de valeurs résolues par le moteur CSS — la seule façon de lire ce
    // que valent RÉELLEMENT 100dvh et env(safe-area-inset-bottom) à l'instant t
    // (et donc de voir si `dvh` est figé pendant que visualViewport bouge).
    const probeStyle: Partial<CSSStyleDeclaration> = {
      position: "fixed",
      top: "0",
      left: "0",
      width: "1px",
      visibility: "hidden",
      pointerEvents: "none",
    };
    const dvhProbe = document.createElement("div");
    Object.assign(dvhProbe.style, probeStyle, { height: "100dvh" });
    const safeProbe = document.createElement("div");
    Object.assign(safeProbe.style, probeStyle, {
      height: "env(safe-area-inset-bottom, 0px)",
    });
    document.body.append(dvhProbe, safeProbe);

    const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
    const now = () => {
      const d = new Date();
      return `${d.toLocaleTimeString("fr-FR")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
    };
    const isStandalone = () =>
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in navigator &&
        (navigator as { standalone?: boolean }).standalone === true);

    // Une ligne compacte = l'état complet du viewport ET du DOM à l'instant t.
    // On lit AUSSI ce que fait réellement le ViewportWatcher (classe nc-kb-open,
    // --nc-vvb) et où sont RÉELLEMENT le shell + la carte : c'est ce qui tranche
    // « le watcher fait-il ce qu'on croit ? » sans supposer.
    const rectOf = (sel: string) => {
      const el = document.querySelector(sel);
      if (!el) return "absent";
      const r = el.getBoundingClientRect();
      return `top${fmt(r.top)}/bot${fmt(r.bottom)}/h${fmt(r.height)}`;
    };
    const css = (name: string) =>
      (getComputedStyle(document.documentElement).getPropertyValue(name) || "unset").trim();
    const readValues = () =>
      [
        // vv.height = DÉTECTION clavier ; vv.offsetTop = POSITIONNEMENT (§1.5).
        `vvH=${vv ? fmt(vv.height) : "n/a"}`,
        `vvOT=${vv ? fmt(vv.offsetTop) : "n/a"}`,
        `vvPT=${vv ? fmt(vv.pageTop) : "n/a"}`,
        `scale=${vv ? vv.scale.toFixed(3) : "n/a"}`,
        `scrollY=${fmt(window.scrollY)}`,
        `ih=${fmt(window.innerHeight)}`,
        `ch=${fmt(document.documentElement.clientHeight)}`,
        // Ce que pose le watcher (v2 : --nc-vvh / --nc-vvot / nc-kb-open) :
        `kbOpen=${document.body.classList.contains("nc-kb-open") ? 1 : 0}`,
        `vvhCSS=${css("--nc-vvh")}`,
        `vvotCSS=${css("--nc-vvot")}`,
        `active=${(document.activeElement?.tagName ?? "?").toLowerCase()}`,
        // Où sont réellement les boîtes (coords écran) — le frame est la clé v2 :
        `frame=${rectOf(".nc-vv-frame")}`,
        `shell=${rectOf(".nc-community-shell")}`,
        `card=${rectOf(".nc-community-card")}`,
        `nav=${rectOf(".nc-bottom-nav")}`,
        `safeB=${fmt(safeProbe.getBoundingClientRect().height)}`,
        `dvh=${fmt(dvhProbe.getBoundingClientRect().height)}`,
        // Compteurs cumulés d'événements (départage silence vs valeur mensongère).
        `rC=${vvResizeCount}`,
        `sC=${vvScrollCount}`,
        // Compensation debug + probes de restauration (§2).
        `comp=${document.body.classList.contains("nc-vv-comp") ? 1 : 0}`,
        `base=${css("--nc-vvbase")}`,
        `screenH=${fmt(window.screen.height)}`,
        `outerH=${fmt(window.outerHeight)}`,
        // Test [CLIP] : le clip levé réveille-t-il un scroll ? (docSH/bodySH doivent
        // rester = viewport, scrollY = 0).
        `clip=${document.documentElement.classList.contains("nc-vv-noclip") ? 0 : 1}`,
        `docSH=${fmt(document.documentElement.scrollHeight)}`,
        `bodySH=${fmt(document.body.scrollHeight)}`,
      ].join(" ");

    // Journal : entrée ajoutée UNIQUEMENT quand les valeurs changent (ou sur
    // focusin/focusout/marque, toujours consignés). Les events redondants
    // incrémentent un compteur « ×n » sur la dernière entrée — sans ça,
    // vv.scroll noierait le journal.
    const log: string[] = [];
    let lastValues = "";
    let lastLine = "";
    let repeat = 0;
    let markCount = 0;
    // Compteurs CUMULÉS d'événements depuis le mount : départagent, pour le
    // symptôme B, (a) silence d'événement (compteurs figés après fermeture) vs
    // (b) événement à valeur mensongère (compteurs qui avancent, vv.height
    // retombé à clientHeight).
    let vvResizeCount = 0;
    let vvScrollCount = 0;
    const pushLog = (line: string) => {
      log.push(line);
      if (log.length > MAX_LOG_ENTRIES) log.shift();
      lastLine = line;
      repeat = 0;
    };
    const record = (trigger: string, force: boolean) => {
      const values = readValues();
      if (values !== lastValues || force) {
        pushLog(`[${now()}] ${trigger.padEnd(9)} ${values}`);
        lastValues = values;
      } else if (lastLine) {
        repeat += 1;
        log[log.length - 1] = `${lastLine}  ×${repeat + 1} (dernier: ${trigger})`;
      }
    };

    let updateCount = 0;
    const renderPanel = (trigger: string) => {
      updateCount += 1;
      panel.textContent =
        readValues().replaceAll(" ", "\n") +
        `\nstandalone=${isStandalone()}` +
        `\nmaj: ${trigger} #${updateCount} ${now()}` +
        `\nmarques: ${markCount} · journal: ${log.length}`;
    };

    // Repositionne la rangée de boutons au BAS de la zone réellement visible
    // (mesure visualViewport, ré-évaluée à chaque event) : clavier ouvert, les
    // boutons flottent au-dessus du clavier ; fermé, au-dessus de la BottomNav.
    // Un `bottom: 0` fixe ne suffirait pas — c'est précisément la métrique
    // qu'iOS fige (l'objet du relevé). Positionner l'outil de mesure via
    // visualViewport reste de l'instrumentation, pas un fix.
    const placeButtons = () => {
      const visibleBottom = vv ? vv.height + vv.offsetTop : window.innerHeight;
      btnRow.style.top = `${Math.round(visibleBottom - 150)}px`;
    };

    const update = (trigger: string, forceLog = false) => {
      record(trigger, forceLog);
      renderPanel(trigger);
      placeButtons();
    };

    const buildText = (tag?: string) => {
      const header = [
        `# Relevé viewport /communaute${tag ? ` [auto:${tag}]` : ""} — ${new Date().toISOString()}`,
        `standalone=${isStandalone()}`,
        `innerWidth=${window.innerWidth} screen=${window.screen.width}x${window.screen.height}`,
        `UA=${navigator.userAgent}`,
        `légende: ih=innerHeight ch=clientHeight vvH=vv.height vvOT=vv.offsetTop vvPT=vv.pageTop rC/sC=compteurs vv.resize/scroll cumulés`,
        "",
      ].join("\n");
      return header + log.join("\n");
    };
    // Auto-POST fire-and-forget (instrumentation §3) : consigne un snapshot forcé
    // puis envoie le journal complet. Chaque appel = une entrée vpdebug distincte
    // dans les logs Vercel.
    const autoPost = (tag: string) => {
      record(tag, true);
      renderPanel(tag);
      fetch("/api/vpdebug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: buildText(tag) }),
      }).catch(() => {});
    };

    apiRef.current = {
      mark: () => {
        markCount += 1;
        pushLog(`────── MARQUE M${markCount} [${now()}] ──────`);
        // Consigne aussi l'état exact au moment de la marque.
        update(`M${markCount}`, true);
        // Feedback visuel : sans lui, impossible de savoir si la marque a pris
        // (le panneau du haut peut être hors de vue clavier ouvert).
        markBtn.textContent = `✓ M${markCount}`;
        setTimeout(() => (markBtn.textContent = "📌 Marquer"), 900);
      },
      // Le presse-papier iOS s'est révélé infiable (Safari Web ET PWA) malgré
      // l'activation utilisateur → canal serveur : le journal part sur la
      // route temporaire /api/vpdebug qui l'écrit dans les logs runtime
      // Vercel, lus directement par l'agent. Zéro manipulation côté device.
      send: async () => {
        const text = buildText();
        copyBtn.textContent = "⏳ envoi…";
        try {
          const res = await fetch("/api/vpdebug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Le contexte (PWA/Safari) est déjà étiqueté dans l'en-tête du
            // journal (`standalone=…`) — rien à préciser à la main.
            body: JSON.stringify({ text }),
          });
          if (!res.ok) throw new Error(String(res.status));
          copyBtn.textContent = "✓ envoyé";
          setTimeout(() => (copyBtn.textContent = "📤 Envoyer"), 2000);
        } catch {
          // Dernier recours : journal plein écran, pré-sélectionné (appui long
          // → Copier manuel). readOnly : pas d'invocation du clavier.
          fallback.value = text;
          if (fallback.parentElement) fallback.parentElement.style.display = "flex";
          fallback.focus();
          fallback.setSelectionRange(0, text.length);
          copyBtn.textContent = "✗ échec — copie manuelle ↑";
          setTimeout(() => (copyBtn.textContent = "📤 Envoyer"), 3000);
        }
      },
    };

    const onVvResize = () => { vvResizeCount += 1; update("vv.resize"); };
    const onVvScroll = () => { vvScrollCount += 1; update("vv.scroll"); };
    const onWinResize = () => update("win.resize");

    // ── Instrumentation des transitions nc-kb-open (§3, diagnostic de B) ──────
    // Auto-POST à chaque pose/retrait + snapshot différé ~1s après le retrait.
    // Échantillonnage 500ms pendant l'état posé ET 3s après le retrait (timers
    // AUTORISÉS ici : outillage debug, pas le watcher de prod). Les compteurs
    // rC/sC dans chaque snapshot départagent silence d'événement vs valeur
    // mensongère après fermeture.
    let sampler: ReturnType<typeof setInterval> | null = null;
    let stopSamplerTimer: ReturnType<typeof setTimeout> | null = null;
    let afterCloseTimer: ReturnType<typeof setTimeout> | null = null;
    const startSampler = () => {
      if (sampler == null) sampler = setInterval(() => update("sample", true), 500);
    };
    const stopSampler = () => {
      if (sampler != null) { clearInterval(sampler); sampler = null; }
    };
    let prevKb = document.body.classList.contains("nc-kb-open");
    const onBodyClass = () => {
      const kb = document.body.classList.contains("nc-kb-open");
      if (kb === prevKb) return;
      prevKb = kb;
      if (kb) {
        startSampler();
        autoPost("kb-open");
      } else {
        autoPost("kb-close");
        if (afterCloseTimer) clearTimeout(afterCloseTimer);
        afterCloseTimer = setTimeout(() => autoPost("kb-close+1s"), 1000);
        if (stopSamplerTimer) clearTimeout(stopSamplerTimer);
        stopSamplerTimer = setTimeout(() => {
          autoPost("kb-close+3s");
          stopSampler();
        }, 3000);
      }
    };
    const bodyObserver = new MutationObserver(onBodyClass);
    bodyObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Snapshot auto sur visibilitychange (§2) : l'app remise au premier plan
    // restaure-t-elle les 956 ? → durée de vie de l'état coincé.
    const onVisibility = () => autoPost(`visibility:${document.visibilityState}`);
    document.addEventListener("visibilitychange", onVisibility);
    // focusin/focusout toujours consignés même à valeurs identiques : c'est la
    // CHRONOLOGIE focus↔resize qu'on cherche (le swipe-down n'émet pas de
    // focusout — le journal doit le montrer).
    const onFocusIn = () => update("focusin", true);
    const onFocusOut = () => update("focusout", true);

    vv?.addEventListener("resize", onVvResize);
    vv?.addEventListener("scroll", onVvScroll);
    window.addEventListener("resize", onWinResize);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);

    wrap.style.display = "flex";
    btnRow.style.display = "flex";
    update("init", true);

    return () => {
      vv?.removeEventListener("resize", onVvResize);
      vv?.removeEventListener("scroll", onVvScroll);
      window.removeEventListener("resize", onWinResize);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      bodyObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stopSampler();
      if (stopSamplerTimer) clearTimeout(stopSamplerTimer);
      if (afterCloseTimer) clearTimeout(afterCloseTimer);
      dvhProbe.remove();
      safeProbe.remove();
      wrap.style.display = "none";
      btnRow.style.display = "none";
      apiRef.current = null;
    };
  }, []);

  // Presser 📌 pendant la saisie ne doit PAS blurer le champ ni fermer le
  // clavier (sinon la mesure (b) est faussée). Sur iOS, preventDefault sur
  // pointerdown NE suffit PAS : c'est `touchend` + preventDefault qui supprime
  // la synthèse mousedown→focus→click (pattern des barres d'outils d'éditeurs).
  // touchend annulé ⇒ pas de click synthétique ⇒ pas de double déclenchement ;
  // onMouseDown couvre le desktop (aucun event touch n'y est émis).
  const markPress = {
    onTouchEnd: (e: React.TouchEvent<HTMLButtonElement>) => {
      e.preventDefault();
      apiRef.current?.mark();
    },
    onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      apiRef.current?.mark();
    },
  };

  const btnStyle: React.CSSProperties = {
    pointerEvents: "auto",
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(0,0,0,0.78)",
    color: "#4ade80",
    font: "700 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace",
  };

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{
        // display: none par défaut — l'effect ne l'affiche que si activé.
        // Rendu inconditionnel côté serveur (pas de branche sur `window`)
        // pour éviter tout mismatch d'hydratation.
        display: "none",
        position: "fixed",
        // Sous la rangée d'actions du haut (~50px + safe-area), pas dessous.
        top: "calc(env(safe-area-inset-top, 0px) + 58px)",
        left: 8,
        zIndex: 99999,
        flexDirection: "column",
        gap: 6,
        alignItems: "flex-start",
        // Le conteneur laisse passer les gestes ; seuls les boutons captent.
        pointerEvents: "none",
      }}
    >
      <pre
        ref={panelRef}
        style={{
          margin: 0,
          padding: "6px 9px",
          borderRadius: 8,
          background: "rgba(0, 0, 0, 0.78)",
          color: "#4ade80",
          font: "600 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
          whiteSpace: "pre",
        }}
      />
      {/* Rangée de boutons SÉPARÉE, repositionnée en continu au bas de la zone
          visible par placeButtons() (top piloté en JS via visualViewport) —
          reste accessible clavier ouvert COMME fermé. */}
      <div
        ref={btnRowRef}
        aria-hidden
        style={{
          display: "none",
          position: "fixed",
          top: 0, // remplacé par placeButtons() dès l'activation
          left: 8,
          zIndex: 99999,
          gap: 6,
          pointerEvents: "none",
        }}
      >
        <button ref={markBtnRef} type="button" style={btnStyle} {...markPress}>
          📌 Marquer
        </button>
        {/* Envoi serveur (Notion) — fermer le clavier en le pressant est sans
            conséquence : on envoie toujours EN FIN de relevé. */}
        <button
          ref={copyBtnRef}
          type="button"
          style={btnStyle}
          onClick={() => void apiRef.current?.send()}
        >
          📤 Envoyer
        </button>
        {/* [COMP] : toggle la compensation viewport standalone (body.nc-vv-comp)
            + émet nc-vv-recompute pour forcer ViewportFrame à recalculer sans
            event viewport. Instrument de test (§1/§2), aucune activation auto. */}
        <button
          type="button"
          style={btnStyle}
          onClick={(e) => {
            const on = document.body.classList.toggle("nc-vv-comp");
            window.dispatchEvent(new Event("nc-vv-recompute"));
            e.currentTarget.textContent = on ? "COMP ✓" : "COMP";
          }}
        >
          COMP
        </button>
        {/* [CLIP] : lève le clip viewport (html.nc-vv-noclip) — teste si le
            tranchage à y=894 vient de notre overflow:hidden root (§ hypothèse).
            Émet nc-vv-recompute comme [COMP]. Instrument de test, aucun autre effet. */}
        <button
          type="button"
          style={btnStyle}
          onClick={(e) => {
            const on = document.documentElement.classList.toggle("nc-vv-noclip");
            window.dispatchEvent(new Event("nc-vv-recompute"));
            e.currentTarget.textContent = on ? "CLIP ✓" : "CLIP";
          }}
        >
          CLIP
        </button>
      </div>
      {/* Plan C si la copie programmatique échoue : journal affiché plein
          écran, pré-sélectionné — appui long → « Copier » manuel d'iOS. */}
      <div
        style={{
          display: "none",
          position: "fixed",
          inset: 12,
          zIndex: 100000,
          flexDirection: "column",
          gap: 8,
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          style={{ ...btnStyle, alignSelf: "flex-end" }}
          onClick={(e) => {
            const box = e.currentTarget.parentElement;
            if (box) box.style.display = "none";
          }}
        >
          ✕ Fermer
        </button>
        <textarea
          ref={fallbackRef}
          readOnly
          style={{
            flex: 1,
            padding: 10,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.25)",
            background: "rgba(0,0,0,0.92)",
            color: "#4ade80",
            font: "500 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
            resize: "none",
          }}
        />
      </div>
    </div>
  );
}
