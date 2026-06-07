// FeedbackWidget — pilote des retours, intégré à la toolbox dev.
//
// Plus de bouton flottant ni de hub modal : la section « retours » (icônes +
// brouillons + tickets) est enregistrée dans le dropdown de la toolbox via
// `useRegisterFeedbackTools`. Ce composant ne rend plus que les overlays :
//   • le mode sélection d'élément (crosshair + highlight),
//   • la modale de saisie du retour (form),
//   • la confirmation de suppression de brouillon,
//   • les toasts.
"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { X, MousePointer, ExternalLink, MessageSquarePlus } from "lucide-react";
import styles from "./FeedbackWidget.module.css";
import { useRegisterFeedbackTools } from "@/shared/components/dev/DevToolbox";
import { FeedbackToolboxPanel } from "./FeedbackToolboxPanel";
import type { Draft, NotionTicket } from "./types";

const PAGE_MAP: Record<string, string> = {
  "/": "Accueil",
  "/login": "Connexion",
  "/signup": "Inscription",
  "/reset-password": "Mot de passe oublié",
  "/update-password": "Nouveau mot de passe",
  "/dashboard": "Accueil",
  "/formation": "Formation",
  "/communaute": "Communauté",
  "/coaching": "Coaching",
  "/ressources": "Ressources",
  "/settings": "Réglages",
};

const PAGE_PREFIXES: [string, string][] = [
  ["/formation", "Formation"],
  ["/communaute", "Communauté"],
  ["/coaching", "Coaching"],
  ["/ressources", "Ressources"],
  ["/settings", "Réglages"],
  ["/dashboard", "Accueil"],
];

const TAG_KIND: Record<string, string> = {
  BUTTON: "Bouton",
  A: "Lien",
  IMG: "Image",
  INPUT: "Champ",
  TEXTAREA: "Champ",
  SELECT: "Menu déroulant",
  NAV: "Barre de navigation",
  HEADER: "En-tête",
  FOOTER: "Pied de page",
  FORM: "Formulaire",
  ASIDE: "Panneau latéral",
  SECTION: "Section",
  ARTICLE: "Carte",
  UL: "Liste",
  OL: "Liste",
};

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

function getCurrentPage(): string {
  const path = window.location.pathname;
  if (PAGE_MAP[path]) return PAGE_MAP[path];
  for (const [prefix, label] of PAGE_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + "/")) return label;
  }
  return "Accueil";
}

function appendPageContext(label: string, page: string): string {
  if (!page) return label;
  if (label.toLowerCase().includes(page.toLowerCase())) return label;
  return `${label} · ${page}`;
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

  const tag = el.tagName;
  const inferredKind = /^H[1-6]$/.test(tag)
    ? "Titre"
    : tag === "svg" || tag === "path" || tag === "use"
      ? "Icône"
      : TAG_KIND[tag] ?? "";

  const interactive = el.closest("a, button, [role='button']") as HTMLElement | null;
  if (interactive) {
    const kind = inferredKind || (interactive.tagName === "A" ? "Lien" : "Bouton");
    const directText = Array.from(interactive.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.textContent?.trim())
      .filter(Boolean)
      .join(" ");
    const text =
      directText ||
      interactive.innerText?.trim() ||
      interactive.getAttribute("aria-label") ||
      "";
    if (text && text.length < 60 && !text.includes("\n")) return `${kind} « ${text} »`;
    return kind;
  }

  if (/^H[1-6]$/.test(tag)) {
    const t = el.innerText.trim().slice(0, 60);
    return t ? `Titre « ${t} »` : "Titre";
  }

  const block = el.closest("section, article, header, footer, nav, main, aside, form");
  if (block) {
    const ariaLabel = block.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.length < 60) return ariaLabel;
    const blockKind = TAG_KIND[block.tagName] ?? "Section";
    const heading = block.querySelector("h1, h2, h3, h4");
    const headingTxt = heading?.textContent?.trim().slice(0, 60);
    if (headingTxt) return `${blockKind} « ${headingTxt} »`;
    return blockKind;
  }

  const ownText = el.innerText?.trim().slice(0, 50);
  if (inferredKind && ownText) return `${inferredKind} « ${ownText} »`;
  if (inferredKind) return inferredKind;
  return ownText || tag.toLowerCase();
}

type ToastType = "success" | "error" | "partial";

export default function FeedbackWidget() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // Brouillons feedback
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Tickets Notion
  const [notionTickets, setNotionTickets] = useState<NotionTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Schéma Notion
  const [actionOptions, setActionOptions] = useState<string[]>(ACTION_OPTIONS_FALLBACK);
  const [endOptions, setEndOptions] = useState<string[]>(END_OPTIONS_FALLBACK);

  // Formulaire
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

  // Body scroll lock quand la modale form est ouverte
  useEffect(() => {
    if (formOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [formOpen]);

  // Schéma Notion — fetch au montage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback-schema");
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.action) && data.action.length > 0) setActionOptions(data.action);
        if (Array.isArray(data.end) && data.end.length > 0) setEndOptions(data.end);
      } catch {
        /* fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setTicketsError(
        err instanceof Error ? err.message : "Impossible de charger les tickets Notion.",
      );
    } finally {
      setLoadingTickets(false);
    }
  }, []);

  // Chargement initial une fois (déféré hors du corps synchrone de l'effet).
  useEffect(() => {
    const id = requestAnimationFrame(() => loadNotionTickets());
    return () => cancelAnimationFrame(id);
  }, [loadNotionTickets]);

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
      if (target.closest("[data-feedback-widget]")) {
        overlay.classList.remove("fb-visible");
        return;
      }
      const rect = target.getBoundingClientRect();
      overlay.style.top = `${rect.top - 4}px`;
      overlay.style.left = `${rect.left - 4}px`;
      overlay.style.width = `${rect.width + 8}px`;
      overlay.style.height = `${rect.height + 8}px`;
      overlay.classList.add("fb-visible");
    }
    function onMouseOver(e: MouseEvent) {
      moveOverlay(e.target as HTMLElement);
    }
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
      setPendingElement(appendPageContext(getElementLabel(target), getCurrentPage()));
      setPendingElementUrl(getElementUrl(target));
      setIsGeneralMode(false);
      setIsSelecting(false);
      setFormOpen(true);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsSelecting(false);
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

  useEffect(() => {
    if (formOpen && pendingElement) setTimeout(() => textareaRef.current?.focus(), 80);
  }, [formOpen, pendingElement]);

  // ── Actions (stables pour la mémoïsation du panneau toolbox) ──
  const startElementFeedback = useCallback(() => {
    setIsSelecting(true);
  }, []);

  const startGeneralFeedback = useCallback(() => {
    setPendingElement("Page entière");
    setPendingElementUrl(window.location.origin + window.location.pathname);
    setIsGeneralMode(true);
    setFormOpen(true);
  }, []);

  function selectAction(action: string) {
    setPendingAction(action);
    setActionError(false);
  }
  function selectEnd(end: string) {
    setPendingEnd((prev) => (prev === end ? "" : end));
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

  function addFeedback() {
    if (!pendingElement || !pendingText.trim()) return;
    if (!isGeneralMode && !pendingAction) {
      setActionError(true);
      return;
    }
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
    setFormOpen(false);
  }

  function cancelForm() {
    resetForm();
    setEditingId(null);
    setFormOpen(false);
  }

  const startEdit = useCallback((draft: Draft) => {
    setEditingId(draft.id);
    setPendingElement(draft.element);
    setPendingElementUrl(draft.elementUrl);
    setPendingAction(draft.action);
    setPendingEnd(draft.end);
    setPendingText(draft.text);
    setIsGeneralMode(!!draft.isGeneral);
    setFormOpen(true);
  }, []);

  const requestDeleteDraft = useCallback((id: string) => {
    setConfirmDeleteId(id);
  }, []);

  function confirmDeleteDraft() {
    if (confirmDeleteId) {
      setDrafts((prev) => prev.filter((d) => d.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    }
  }

  const deleteNotionTicket = useCallback(
    async (notionId: string) => {
      setDeletingId(notionId);
      setNotionTickets((prev) => prev.filter((t) => t.notionId !== notionId));
      try {
        const res = await fetch(`/api/tickets?id=${encodeURIComponent(notionId)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error();
      } catch {
        showToast("Suppression échouée, rechargement...", "error");
        await loadNotionTickets();
      } finally {
        setDeletingId(null);
      }
    },
    [showToast, loadNotionTickets],
  );

  function handleFormKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addFeedback();
    if (e.key === "Escape") cancelForm();
  }

  const sendAll = useCallback(async () => {
    if (drafts.length === 0 || isSending) return;
    setIsSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId.current,
          feedbacks: drafts.map((d) => ({
            element: d.element,
            elementUrl: d.elementUrl,
            action: d.action,
            end: d.end,
            page: d.page,
            text: d.text,
            timestamp: d.timestamp,
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
          res.status === 207 ? "partial" : "success",
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
  }, [drafts, isSending, showToast, loadNotionTickets]);

  const currentPlaceholder = PLACEHOLDERS[pendingAction] ?? PLACEHOLDERS.default;

  // Enregistre la section retours dans le dropdown de la toolbox.
  const feedbackPanel = useMemo(
    () => (
      <FeedbackToolboxPanel
        onElement={startElementFeedback}
        onGeneral={startGeneralFeedback}
        drafts={drafts}
        notionTickets={notionTickets}
        loadingTickets={loadingTickets}
        ticketsError={ticketsError}
        deletingId={deletingId}
        isSending={isSending}
        onEditDraft={startEdit}
        onDeleteDraft={requestDeleteDraft}
        onSend={sendAll}
        onRefreshTickets={loadNotionTickets}
        onDeleteTicket={deleteNotionTicket}
      />
    ),
    [
      startElementFeedback,
      startGeneralFeedback,
      drafts,
      notionTickets,
      loadingTickets,
      ticketsError,
      deletingId,
      isSending,
      startEdit,
      requestDeleteDraft,
      sendAll,
      loadNotionTickets,
      deleteNotionTicket,
    ],
  );
  useRegisterFeedbackTools(feedbackPanel);

  // ── RENDER : overlays uniquement ───────────────────────────────────────────
  return (
    <>
      {/* Modale de saisie du retour */}
      {formOpen && pendingElement && (
        <div
          data-feedback-widget="true"
          className={styles.backdrop}
          onClick={(e) => {
            if (e.target === e.currentTarget) cancelForm();
          }}
        >
          <div className={styles.modal} role="dialog" aria-label="Saisie du retour">
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <div className={styles.avatarSmall} aria-hidden="true">
                  <MessageSquarePlus size={18} strokeWidth={2} />
                </div>
                <div>
                  <p className={styles.modalTitle}>
                    {isGeneralMode
                      ? "Feedback général"
                      : editingId
                        ? "Modifier le retour"
                        : "Nouveau retour"}
                  </p>
                  <p className={styles.modalSub}>
                    {typeof window !== "undefined" ? getCurrentPage() : ""}
                  </p>
                </div>
              </div>
              <button className={styles.closeBtn} onClick={cancelForm} aria-label="Fermer">
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.pendingForm}>
                <div className={styles.pendingCover}>
                  <span className={styles.pendingCoverEyebrow}>
                    {isGeneralMode
                      ? "Feedback général sur la page"
                      : editingId
                        ? "Modification"
                        : "Bloc sélectionné"}
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
                    <p className={styles.fieldError}>
                      Sélectionnez un type de modification avant de continuer.
                    </p>
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
                  <button className={styles.cancelBtn} onClick={cancelForm}>
                    Annuler
                  </button>
                  <button
                    className={styles.addBtn}
                    onClick={addFeedback}
                    disabled={!pendingText.trim()}
                  >
                    {editingId ? "Mettre à jour" : "Ajouter au brouillon"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation suppression brouillon (déclenchée depuis la toolbox) */}
      {confirmDeleteId && (
        <div className={styles.confirmOverlay} data-feedback-widget="true">
          <div className={styles.confirmBox}>
            <p className={styles.confirmTitle}>Supprimer ce brouillon ?</p>
            <p className={styles.confirmText}>
              Ce retour sera supprimé définitivement et ne sera pas envoyé à Notion.
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.cancelBtn} onClick={() => setConfirmDeleteId(null)}>
                Annuler
              </button>
              <button
                className={`${styles.addBtn} ${styles.confirmDeleteBtn}`}
                onClick={confirmDeleteDraft}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bandeau mode sélection */}
      {isSelecting && (
        <div data-feedback-widget="true" className={styles.selectionHint}>
          <MousePointer size={13} />
          Cliquez sur un élément pour l&apos;annoter
          <button onClick={() => setIsSelecting(false)}>Annuler</button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          data-feedback-widget="true"
          className={`${styles.toast} ${styles[`toast_${toast.type}`]}`}
          role="alert"
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
