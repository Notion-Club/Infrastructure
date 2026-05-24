// FeedbackWidget — Hub modal flouté avec 2 flows :
//   • Feedback sur un élément (sélection visuelle)
//   • Feedback général (page entière, sans sélection)
// Tickets Notion accessibles en vue grille depuis le hub.
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, MousePointer, Send, Trash2, RefreshCw, MoreHorizontal, Pencil, ExternalLink,
  MessageSquarePlus, Globe, LayoutGrid, ArrowLeft,
} from "lucide-react";
import styles from "./FeedbackWidget.module.css";
import { useTheme } from "@/shared/lib/hooks/useTheme";

// Map adaptée aux routes existantes de NotionClub Infra. Toute route non listée
// (ex. routes dynamiques /communaute/post/[id]) retombe sur "Home" — comportement
// du code source d'origine, à confirmer si on veut un libellé plus précis.
const PAGE_MAP: Record<string, string> = {
  "/": "Home",
  "/login": "Login",
  "/signup": "Signup",
  "/reset-password": "Reset password",
  "/update-password": "Update password",
  "/dashboard": "Dashboard",
  "/communaute": "Communauté",
  "/coaching": "Coaching",
  "/ressources": "Ressources",
  "/settings": "Réglages",
};

// Fallback minimaliste si l'appel `/api/feedback-schema` échoue. Les vraies
// options sont récupérées dynamiquement depuis la base Notion au montage du
// widget — voir `loadSchema` plus bas.
const ACTION_OPTIONS_FALLBACK: string[] = [
  "Modifier du texte",
  "Ajouter du texte",
  "Ajouter une image",
  "Changer une couleur",
  "Modifier la mise en page",
  "Supprimer un élément",
  "Ajouter un lien",
  "Corriger une faute",
  "Autre",
];

const END_OPTIONS_FALLBACK: string[] = ["Frontend", "Backend"];

// Placeholders contextuels pour les actions connues. Pour toute action retournée
// par Notion qui n'est pas listée ici, on retombe sur `default`.
const PLACEHOLDERS: Record<string, string> = {
  "Modifier du texte": "Quel texte souhaitez-vous modifier ? Quelle formulation préférez-vous à la place ?",
  "Ajouter du texte": "Quel contenu souhaitez-vous ajouter et à quel emplacement précis sur la page ?",
  "Ajouter une image": "Quelle image souhaitez-vous intégrer ? Avez-vous un fichier ou une référence à proposer ?",
  "Changer une couleur": "Quelle couleur ou quel style souhaitez-vous appliquer ? Une référence visuelle aide beaucoup.",
  "Modifier la mise en page": "Comment souhaitez-vous réorganiser cet élément ? Un croquis ou une description suffit.",
  "Supprimer un élément": "Confirmez-vous la suppression ? Y a-t-il quelque chose à mettre à la place ?",
  "Ajouter un lien": "Vers quelle page ou adresse ce lien doit-il pointer ?",
  "Corriger une faute": "Quelle est la formulation correcte que vous souhaitez voir apparaître ?",
  "Autre": "Décrivez précisément votre retour : contexte, attente, exemple si possible.",
  default: "Décrivez précisément votre retour : contexte, attente, exemple si possible.",
};

type StatusColors = { dot: string; bg: string; textLight: string; textDark: string; cssClass: string };
const STATUS_COLORS: Record<string, StatusColors> = {
  "À traiter": { dot: "#f59e0b", bg: "rgba(245,158,11,0.08)", textLight: "#92400e", textDark: "#fbbf24", cssClass: styles.statusPending },
  "En cours":  { dot: "#3b82f6", bg: "rgba(59,130,246,0.08)", textLight: "#1e40af", textDark: "#60a5fa", cssClass: styles.statusProgress },
  "Traité":    { dot: "#10b981", bg: "rgba(16,185,129,0.08)", textLight: "#065f46", textDark: "#34d399", cssClass: styles.statusDone },
  "Résolu":    { dot: "#10b981", bg: "rgba(16,185,129,0.08)", textLight: "#065f46", textDark: "#34d399", cssClass: styles.statusDone },
  "Refusé":    { dot: "#e0625a", bg: "rgba(224,98,90,0.08)",  textLight: "#9a3a35", textDark: "#e0625a", cssClass: styles.statusRefused },
};

function getCurrentPage(): string {
  return PAGE_MAP[window.location.pathname] ?? "Home";
}

function getElementUrl(el: HTMLElement): string {
  let current: HTMLElement | null = el;
  while (current && current !== document.body) {
    if (current.id && !current.id.startsWith("fb-") && !current.getAttribute("data-feedback-widget")) {
      return `${window.location.origin}${window.location.pathname}#${current.id}`;
    }
    current = current.parentElement;
  }
  return window.location.origin + window.location.pathname;
}

function getElementLabel(el: HTMLElement): string {
  let current: HTMLElement | null = el;
  while (current && current !== document.body) {
    const label = current.getAttribute("data-fb-label");
    if (label) return label;
    current = current.parentElement;
  }
  const interactive = el.closest("a, button");
  if (interactive) {
    const linkEl = interactive as HTMLElement;
    const directText = Array.from(linkEl.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    const text = directText || linkEl.innerText?.trim();
    if (text && text.length < 60 && !text.includes("\n")) return text;
  }
  if (/^H[1-6]$/.test(el.tagName)) return el.innerText.trim().slice(0, 60);
  const block = el.closest("section, article, header, footer, nav, main, aside, form");
  if (block) {
    const ariaLabel = block.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.length < 60) return ariaLabel;
    const heading = block.querySelector("h1, h2, h3, h4");
    if (heading) return heading.textContent?.trim().slice(0, 60) || "";
    const tagLabels: Record<string, string> = {
      HEADER: "En-tête de page", FOOTER: "Pied de page",
      NAV: "Navigation", MAIN: "Contenu principal",
      FORM: "Formulaire", ASIDE: "Barre latérale",
    };
    return tagLabels[block.tagName] || "Section";
  }
  return el.innerText?.trim().slice(0, 50) || el.tagName.toLowerCase();
}

interface Draft {
  id: string;
  element: string;
  elementUrl: string;
  action: string;
  end: string;
  page: string;
  text: string;
  timestamp: string;
  isGeneral?: boolean;
}

interface NotionTicket {
  notionId: string;
  element: string;
  action: string;
  page: string;
  text: string;
  status: string;
  statusColor: string;
  timestamp: string;
}

type ToastType = "success" | "error" | "partial";
type View = "hub" | "form" | "tickets";

const TEXT_CLAMP = 200;

function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > TEXT_CLAMP;
  return (
    <div>
      <p className={styles.feedbackText}>
        {isLong && !expanded ? `${text.slice(0, TEXT_CLAMP)}…` : text}
      </p>
      {isLong && (
        <button className={styles.expandBtn} onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Voir moins" : `Voir plus (+${text.length - TEXT_CLAMP} car.)`}
        </button>
      )}
    </div>
  );
}

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<View>("hub");
  const [showBubble, setShowBubble] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);

  // Brouillons feedback
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Tickets Notion
  const [notionTickets, setNotionTickets] = useState<NotionTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Schéma Notion — liste réelle des options des selects/multi_selects, fetchée
  // au montage via `/api/feedback-schema`. Fallback sur les listes locales en
  // attendant la réponse ou si l'API échoue.
  const [actionOptions, setActionOptions] = useState<string[]>(ACTION_OPTIONS_FALLBACK);
  const [endOptions, setEndOptions] = useState<string[]>(END_OPTIONS_FALLBACK);

  // Formulaire feedback (élément ou général)
  const [pendingElement, setPendingElement] = useState<string | null>(null);
  const [pendingElementUrl, setPendingElementUrl] = useState<string>("");
  const [pendingAction, setPendingAction] = useState("");
  const [pendingEnd, setPendingEnd] = useState<string>("");
  const [pendingText, setPendingText] = useState("");
  const [actionError, setActionError] = useState(false);
  const [isGeneralMode, setIsGeneralMode] = useState(false);

  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const sessionId = useRef("");
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Init
  useEffect(() => {
    sessionId.current = crypto.randomUUID();

    if (!document.getElementById("fb-highlight-style")) {
      const style = document.createElement("style");
      style.id = "fb-highlight-style";
      style.textContent = `
        @keyframes fbSweep {
          0%   { transform: translateX(-100%) skewX(-12deg); opacity: 0; }
          20%  { opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateX(350%) skewX(-12deg); opacity: 0; }
        }
        [data-feedback-highlight] {
          position: fixed; pointer-events: none; z-index: 8990;
          border-radius: 14px;
          transition: top 60ms cubic-bezier(0.22,1,0.36,1), left 60ms cubic-bezier(0.22,1,0.36,1), width 60ms cubic-bezier(0.22,1,0.36,1), height 60ms cubic-bezier(0.22,1,0.36,1), opacity 150ms ease;
          box-shadow:
            0 0 0 2px #e0625a,
            0 0 0 6px rgba(224,98,90,0.18),
            0 0 28px rgba(224,98,90,0.36),
            inset 0 0 20px rgba(224,98,90,0.05);
          overflow: hidden; opacity: 0;
        }
        [data-feedback-highlight].fb-visible { opacity: 1; }
        [data-feedback-highlight]::after {
          content: ''; position: absolute; top: 0; left: 0; width: 45%; height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(224,98,90,0.28) 50%, transparent 100%);
          animation: fbSweep 2s ease-in-out infinite;
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      document.getElementById("fb-highlight-style")?.remove();
      highlightRef.current?.remove();
      highlightRef.current = null;
    };
  }, []);

  // Bulle d'intro
  useEffect(() => {
    const t = setTimeout(() => setShowBubble(true), 1000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!showBubble) return;
    const t = setTimeout(() => setShowBubble(false), 5000);
    return () => clearTimeout(t);
  }, [showBubble]);

  // Body scroll lock quand le modal est ouvert
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [isOpen]);

  // Schéma Notion — un fetch au montage du widget, met à jour les pills si la
  // base contient plus / d'autres options que le fallback hardcodé. On garde
  // les fallbacks affichés en attendant pour éviter un état vide.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback-schema");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.action) && data.action.length > 0) {
          setActionOptions(data.action);
        }
        if (Array.isArray(data.end) && data.end.length > 0) {
          setEndOptions(data.end);
        }
      } catch {
        // Silencieux — on reste sur les fallbacks.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Fermer menu trois points si clic en dehors
  useEffect(() => {
    if (!menuOpenId) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpenId]);

  // Chargement tickets
  const loadNotionTickets = useCallback(async () => {
    setLoadingTickets(true);
    setTicketsError(null);
    try {
      const res = await fetch("/api/tickets");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Erreur ${res.status}`);
      }
      const data = await res.json();
      setNotionTickets(data.tickets ?? []);
    } catch (err) {
      setTicketsError(err instanceof Error ? err.message : "Impossible de charger les tickets Notion.");
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  // Charger à l'ouverture (une fois)
  const hasLoadedOnce = useRef(false);
  useEffect(() => {
    if (isOpen && !hasLoadedOnce.current) {
      hasLoadedOnce.current = true;
      loadNotionTickets();
    }
  }, [isOpen, loadNotionTickets]);

  // Toast helper
  const showToast = useCallback((message: string, type: ToastType) => {
    setToast({ message, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // Mode sélection d'élément
  useEffect(() => {
    if (!isSelecting) {
      highlightRef.current?.classList.remove("fb-visible");
      return;
    }
    if (!highlightRef.current) {
      const div = document.createElement("div");
      div.setAttribute("data-feedback-highlight", "true");
      div.setAttribute("data-feedback-widget", "true");
      document.body.appendChild(div);
      highlightRef.current = div;
    }
    const overlay = highlightRef.current;

    function moveOverlay(target: HTMLElement) {
      if (target.closest("[data-feedback-widget]")) { overlay.classList.remove("fb-visible"); return; }
      const rect = target.getBoundingClientRect();
      overlay.style.top = `${rect.top - 4}px`;
      overlay.style.left = `${rect.left - 4}px`;
      overlay.style.width = `${rect.width + 8}px`;
      overlay.style.height = `${rect.height + 8}px`;
      overlay.classList.add("fb-visible");
    }
    function onMouseOver(e: MouseEvent) { moveOverlay(e.target as HTMLElement); }
    function onMouseOut(e: MouseEvent) {
      if ((e.target as HTMLElement).closest("[data-feedback-widget]")) return;
      overlay.classList.remove("fb-visible");
    }
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest("[data-feedback-widget]")) return;
      e.preventDefault();
      e.stopPropagation();
      overlay.classList.remove("fb-visible");
      setPendingElement(getElementLabel(target));
      setPendingElementUrl(getElementUrl(target));
      setIsGeneralMode(false);
      setIsSelecting(false);
      setView("form");
      setIsOpen(true);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsSelecting(false);
        setIsOpen(true);
      }
    }
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("click", onClick, true);
    document.addEventListener("keydown", onEsc);
    document.body.style.cursor = "crosshair";
    return () => {
      document.removeEventListener("mouseover", onMouseOver, true);
      document.removeEventListener("mouseout", onMouseOut, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("keydown", onEsc);
      document.body.style.cursor = "";
      overlay.classList.remove("fb-visible");
    };
  }, [isSelecting]);

  // Focus textarea quand on entre dans le form
  useEffect(() => {
    if (view === "form" && pendingElement) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [view, pendingElement]);

  // Actions
  function startElementFeedback() {
    setIsOpen(false);
    setIsSelecting(true);
  }

  function startGeneralFeedback() {
    setPendingElement("Page entière");
    setPendingElementUrl(window.location.origin + window.location.pathname);
    setIsGeneralMode(true);
    setView("form");
  }

  function openTickets() {
    setView("tickets");
    loadNotionTickets();
  }

  function selectAction(action: string) {
    setPendingAction(action);
    setActionError(false);
  }

  function selectEnd(end: string) {
    setPendingEnd((prev) => (prev === end ? "" : end));
  }

  function addFeedback() {
    if (!pendingElement || !pendingText.trim()) return;
    // Action n'est obligatoire que pour un feedback sur élément ciblé.
    // En feedback général, on accepte un envoi sans Action (la propriété restera vide dans Notion).
    if (!isGeneralMode && !pendingAction) { setActionError(true); return; }

    const draft: Draft = {
      id: editingId ?? crypto.randomUUID(),
      element: pendingElement,
      elementUrl: pendingElementUrl,
      action: pendingAction,
      end: pendingEnd,
      page: getCurrentPage(),
      text: pendingText.trim(),
      timestamp: new Date().toISOString(),
      isGeneral: isGeneralMode,
    };

    if (editingId) {
      setDrafts((prev) => prev.map((d) => (d.id === editingId ? draft : d)));
      setEditingId(null);
    } else {
      setDrafts((prev) => [...prev, draft]);
    }
    resetForm();
    setView("hub");
  }

  function resetForm() {
    setPendingElement(null);
    setPendingElementUrl("");
    setPendingAction("");
    setPendingEnd("");
    setPendingText("");
    setActionError(false);
    setIsGeneralMode(false);
  }

  function cancelForm() {
    resetForm();
    setEditingId(null);
    setView("hub");
  }

  function startEdit(draft: Draft) {
    setMenuOpenId(null);
    setEditingId(draft.id);
    setPendingElement(draft.element);
    setPendingElementUrl(draft.elementUrl);
    setPendingAction(draft.action);
    setPendingEnd(draft.end);
    setPendingText(draft.text);
    setIsGeneralMode(!!draft.isGeneral);
    setView("form");
  }

  function requestDeleteDraft(id: string) {
    setMenuOpenId(null);
    setConfirmDeleteId(id);
  }

  function confirmDeleteDraft() {
    if (confirmDeleteId) {
      setDrafts((prev) => prev.filter((d) => d.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    }
  }

  async function deleteNotionTicket(notionId: string) {
    setDeletingId(notionId);
    setNotionTickets((prev) => prev.filter((t) => t.notionId !== notionId));
    try {
      const res = await fetch(`/api/tickets?id=${encodeURIComponent(notionId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
    } catch {
      showToast("Suppression échouée, rechargement...", "error");
      await loadNotionTickets();
    } finally {
      setDeletingId(null);
    }
  }

  function handleFormKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addFeedback();
    if (e.key === "Escape") cancelForm();
  }

  async function sendAll() {
    if (drafts.length === 0 || isSending) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          feedbacks: drafts.map((d) => ({
            element: d.element, elementUrl: d.elementUrl, action: d.action,
            end: d.end, page: d.page, text: d.text, timestamp: d.timestamp,
          })),
        }),
      });
      const data = await res.json();
      if (res.status === 200 || res.status === 207) {
        setDrafts([]);
        sessionId.current = crypto.randomUUID();
        showToast(
          res.status === 207
            ? `${data.created} retour(s) envoyé(s), ${data.failed} non transmis`
            : "Retours envoyés avec succès",
          res.status === 207 ? "partial" : "success"
        );
        await loadNotionTickets();
      } else {
        showToast("Erreur lors de l'envoi, réessayez ou contactez Théo", "error");
      }
    } catch {
      showToast("Erreur réseau, réessayez ou contactez Théo", "error");
    } finally {
      setIsSending(false);
    }
  }

  const currentPlaceholder = PLACEHOLDERS[pendingAction] ?? PLACEHOLDERS.default;

  const { theme } = useTheme();
  function StatusBadge({ status }: { status: string }) {
    const s = STATUS_COLORS[status] ?? { dot: "#9CA3AF", bg: "rgba(156,163,175,0.1)", textLight: "#6B7280", textDark: "#94a3b8", cssClass: styles.statusDefault };
    return (
      <span className={`${styles.statusBadge} ${s.cssClass}`} style={{ background: s.bg, color: theme === "dark" ? s.textDark : s.textLight }}>
        <span className={styles.statusDot} style={{ background: s.dot }} />
        {status}
      </span>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Trigger */}
      {!isOpen && !isSelecting && (
        <div className={styles.triggerWrap} data-feedback-widget="true">
          {showBubble && <div className={styles.bubble}>Tu as des retours ?</div>}
          <button
            className={styles.trigger}
            onClick={() => { setIsOpen(true); setView("hub"); setShowBubble(false); }}
            aria-label="Ouvrir l&apos;outil de retours"
          >
            <MessageSquarePlus size={24} strokeWidth={2} className={styles.triggerIcon} />
          </button>
        </div>
      )}

      {/* Modal */}
      {isOpen && (
        <div
          data-feedback-widget="true"
          className={styles.backdrop}
          onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false); }}
        >
          <div className={styles.modal} role="dialog" aria-label="Outil de retours">
            {/* Header */}
            <div className={styles.modalHeader}>
              {view !== "hub" && (
                <button
                  className={styles.backBtn}
                  onClick={() => { resetForm(); setView("hub"); }}
                  aria-label="Retour"
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <div className={styles.modalHeaderLeft}>
                <div className={styles.avatarSmall} aria-hidden="true">
                  <MessageSquarePlus size={18} strokeWidth={2} />
                </div>
                <div>
                  <p className={styles.modalTitle}>
                    {view === "hub" && "Outil de retours"}
                    {view === "form" && (isGeneralMode ? "Feedback général" : (editingId ? "Modifier le retour" : "Nouveau retour"))}
                    {view === "tickets" && "Retours envoyés"}
                  </p>
                  <p className={styles.modalSub}>
                    {view === "hub" && "Que veux-tu faire aujourd'hui ?"}
                    {view !== "hub" && (typeof window !== "undefined" ? getCurrentPage() : "")}
                  </p>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsOpen(false)} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className={styles.modalBody}>
              {/* ──── HUB ──── */}
              {view === "hub" && (
                <div className={styles.hub}>
                  <div className={styles.actionCards}>
                    <button className={styles.actionCard} onClick={startElementFeedback}>
                      <div className={`${styles.actionCardIcon} ${styles.iconBordeaux}`}>
                        <MousePointer size={22} strokeWidth={1.5} />
                      </div>
                      <h3 className={styles.actionCardTitle}>Retour sur un élément</h3>
                      <p className={styles.actionCardText}>
                        Sélectionner précisément un bloc de la page et décrire ce qu&apos;il faut changer dessus.
                      </p>
                      <span className={styles.actionCardCta}>Sélectionner</span>
                    </button>

                    <button className={styles.actionCard} onClick={startGeneralFeedback}>
                      <div className={`${styles.actionCardIcon} ${styles.iconBlue}`}>
                        <Globe size={22} strokeWidth={1.5} />
                      </div>
                      <h3 className={styles.actionCardTitle}>Feedback général</h3>
                      <p className={styles.actionCardText}>
                        Remarque globale sur la page entière, sans cibler un élément précis (ex. favicon, ressenti global).
                      </p>
                      <span className={styles.actionCardCta}>Écrire</span>
                    </button>
                  </div>

                  {/* Brouillons */}
                  {drafts.length > 0 && (
                    <div className={styles.listSection}>
                      <p className={styles.listHeading}>
                        Brouillons en attente <span className={styles.listCount}>{drafts.length}</span>
                      </p>
                      <ul className={styles.list}>
                        {drafts.map((draft) => (
                          <li key={draft.id} className={styles.feedbackItem}>
                            <div className={styles.feedbackItemRow}>
                              <span className={styles.actionTag}>
                                {draft.isGeneral ? "Général" : draft.action}
                              </span>
                              {draft.end && <span className={styles.actionTag}>{draft.end}</span>}
                              <div className={styles.draftMenu} ref={menuOpenId === draft.id ? menuRef : null}>
                                <button
                                  className={styles.menuTrigger}
                                  onClick={() => setMenuOpenId(menuOpenId === draft.id ? null : draft.id)}
                                  aria-label="Options"
                                >
                                  <MoreHorizontal size={14} />
                                </button>
                                {menuOpenId === draft.id && (
                                  <div className={styles.menuDropdown}>
                                    <button className={styles.menuItem} onClick={() => startEdit(draft)}>
                                      <Pencil size={13} /> Modifier
                                    </button>
                                    <button
                                      className={`${styles.menuItem} ${styles.menuItemDanger}`}
                                      onClick={() => requestDeleteDraft(draft.id)}
                                    >
                                      <Trash2 size={13} /> Supprimer
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <p className={styles.feedbackElement}>{draft.element}</p>
                            {draft.elementUrl && !draft.isGeneral && (
                              <a
                                href={draft.elementUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.elementLink}
                              >
                                <ExternalLink size={11} />
                                {draft.elementUrl.replace(typeof window !== "undefined" ? window.location.origin : "", "")}
                              </a>
                            )}
                            <ExpandableText text={draft.text} />
                          </li>
                        ))}
                      </ul>
                      <button
                        className={styles.sendBtn}
                        onClick={sendAll}
                        disabled={isSending}
                        aria-busy={isSending}
                      >
                        {isSending ? "Envoi en cours..." : <><Send size={14} />Envoyer {drafts.length} retour{drafts.length > 1 ? "s" : ""}</>}
                      </button>
                    </div>
                  )}

                  <button className={styles.viewTicketsBtn} onClick={openTickets}>
                    <LayoutGrid size={14} />
                    Voir mes retours envoyés
                    {notionTickets.length > 0 && (
                      <span className={`${styles.listCount} ${styles.listCountNotion}`}>{notionTickets.length}</span>
                    )}
                  </button>
                </div>
              )}

              {/* ──── FORM ──── */}
              {view === "form" && pendingElement && (
                <div className={styles.pendingForm}>
                  <div className={styles.pendingCover}>
                    <span className={styles.pendingCoverEyebrow}>
                      {isGeneralMode ? "Feedback général sur la page" : editingId ? "Modification" : "Bloc sélectionné"}
                    </span>
                    <p className={styles.pendingCoverName}>{pendingElement}</p>
                    {pendingElementUrl && !isGeneralMode && (
                      <a
                        href={pendingElementUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.elementLink}
                      >
                        <ExternalLink size={11} />
                        {pendingElementUrl.replace(window.location.origin, "")}
                      </a>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      Type de modification {!isGeneralMode && <span aria-hidden="true">*</span>}
                      {isGeneralMode && <span className={styles.fieldOptional}>(optionnel)</span>}
                    </label>
                    <div className={`${styles.actionPills} ${actionError ? styles.actionPillsError : ""}`}>
                      {actionOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`${styles.actionPill} ${pendingAction === opt ? styles.actionPillActive : ""}`}
                          onClick={() => selectAction(opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {actionError && !isGeneralMode && (
                      <p className={styles.fieldError}>Sélectionnez un type de modification avant de continuer.</p>
                    )}
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      Côté concerné <span className={styles.fieldOptional}>(optionnel)</span>
                    </label>
                    <div className={styles.actionPills}>
                      {endOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`${styles.actionPill} ${pendingEnd === opt ? styles.actionPillActive : ""}`}
                          onClick={() => selectEnd(opt)}
                          aria-pressed={pendingEnd === opt}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>
                      Détail du retour <span aria-hidden="true">*</span>
                    </label>
                    <textarea
                      ref={textareaRef}
                      className={styles.textarea}
                      placeholder={currentPlaceholder}
                      value={pendingText}
                      onChange={(e) => setPendingText(e.target.value)}
                      onKeyDown={handleFormKeyDown}
                      rows={6}
                    />
                    <span className={styles.fieldHint}>Cmd+Entrée pour ajouter au brouillon</span>
                  </div>

                  <div className={styles.pendingActions}>
                    <button className={styles.cancelBtn} onClick={cancelForm}>Annuler</button>
                    <button
                      className={styles.addBtn}
                      onClick={addFeedback}
                      disabled={!pendingText.trim()}
                    >
                      {editingId ? "Mettre à jour" : "Ajouter au brouillon"}
                    </button>
                  </div>
                </div>
              )}

              {/* ──── TICKETS ──── */}
              {view === "tickets" && (
                <div className={styles.ticketsView}>
                  <div className={styles.listHeadingRow}>
                    <p className={styles.listHeading}>
                      Mes retours envoyés
                      {!loadingTickets && notionTickets.length > 0 && (
                        <span className={`${styles.listCount} ${styles.listCountNotion}`}>{notionTickets.length}</span>
                      )}
                    </p>
                    <button
                      className={styles.refreshBtn}
                      onClick={loadNotionTickets}
                      disabled={loadingTickets}
                      aria-label="Rafraîchir"
                      title="Rafraîchir"
                    >
                      <RefreshCw size={13} className={loadingTickets ? styles.spinning : ""} />
                    </button>
                  </div>

                  {loadingTickets && notionTickets.length === 0 && (
                    <p className={styles.loadingText}>Chargement des tickets...</p>
                  )}
                  {!loadingTickets && ticketsError && (
                    <p className={styles.errorSmall}>{ticketsError}</p>
                  )}
                  {!loadingTickets && !ticketsError && notionTickets.length === 0 && (
                    <p className={styles.emptySmall}>Aucun ticket dans Notion pour l&apos;instant.</p>
                  )}

                  {notionTickets.length > 0 && (
                    <div className={styles.ticketsGrid}>
                      {notionTickets.map((ticket) => (
                        <div key={ticket.notionId} className={`${styles.feedbackItem} ${styles.notionItem}`}>
                          <div className={styles.notionItemHeader}>
                            <p className={styles.feedbackElement}>{ticket.element || "Sans titre"}</p>
                            <button
                              className={`${styles.menuTrigger} ${styles.menuTriggerDanger}`}
                              onClick={() => deleteNotionTicket(ticket.notionId)}
                              disabled={deletingId === ticket.notionId}
                              aria-label="Supprimer ce ticket"
                              title="Supprimer de Notion"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                          {ticket.text && <ExpandableText text={ticket.text} />}
                          <div className={styles.notionItemFooter}>
                            {ticket.action && <span className={styles.actionTag}>{ticket.action}</span>}
                            <StatusBadge status={ticket.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Confirmation suppression brouillon */}
          {confirmDeleteId && (
            <div className={styles.confirmOverlay} data-feedback-widget="true">
              <div className={styles.confirmBox}>
                <p className={styles.confirmTitle}>Supprimer ce brouillon ?</p>
                <p className={styles.confirmText}>
                  Ce retour sera supprimé définitivement et ne sera pas envoyé à Notion.
                </p>
                <div className={styles.confirmActions}>
                  <button className={styles.cancelBtn} onClick={() => setConfirmDeleteId(null)}>Annuler</button>
                  <button className={`${styles.addBtn} ${styles.confirmDeleteBtn}`} onClick={confirmDeleteDraft}>
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bandeau mode sélection */}
      {isSelecting && (
        <div data-feedback-widget="true" className={styles.selectionHint}>
          <MousePointer size={13} />
          Cliquez sur un élément pour l&apos;annoter
          <button onClick={() => { setIsSelecting(false); setIsOpen(true); }}>Annuler</button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div data-feedback-widget="true" className={`${styles.toast} ${styles[`toast_${toast.type}`]}`} role="alert">
          {toast.message}
        </div>
      )}
    </>
  );
}
