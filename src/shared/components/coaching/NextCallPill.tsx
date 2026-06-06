"use client";

// Pill "Ton prochain coaching est…" — visible uniquement si un appel à venir
// existe pour l'user dans la DB Notion Appels de suivi.
//
// Comportements :
//   • Libellé calculé via formatNextCallLabel (aujourd'hui / demain / dans X j)
//   • Clic → ouvre NextCallDetailModal avec date + host + objet + reschedule URL
//
// Le calcul du libellé tourne au render — il devient stale si la session reste
// ouverte la nuit (passage minuit). Acceptable V1 : un refresh page corrige.

import { useState } from "react";
import { Calendar } from "lucide-react";
import { NextCallDetailModal } from "./NextCallDetailModal";
import { formatNextCallLabel } from "@/shared/lib/coaching/formatNextCallLabel";

export interface NextCallPillData {
  scheduledAt: string;
  host: string;
  hostAvatarUrl: string | null;
  objectRequest: string | null;
  rescheduleUrl: string | null;
}

interface NextCallPillProps {
  data: NextCallPillData;
}

export function NextCallPill({ data }: NextCallPillProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const label = formatNextCallLabel(data.scheduledAt);
  if (!label) return null;

  return (
    <>
      <div style={{ marginTop: 4 }}>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          data-fb-label="Badge prochain coaching · En-tête coaching"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "#e0625a",
            background: "var(--color-surface-card)",
            borderRadius: 9999,
            padding: "5px 14px",
            border: "1px solid rgba(224,98,90,0.25)",
            boxShadow: "0 1px 4px rgba(224,98,90,0.08)",
            cursor: "pointer",
            transition: "transform 180ms ease, box-shadow 180ms ease",
          }}
          className="hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(224,98,90,0.15)]"
        >
          <Calendar size={13} style={{ flexShrink: 0 }} />
          {label}
        </button>
      </div>

      <NextCallDetailModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        scheduledAt={data.scheduledAt}
        host={data.host}
        hostAvatarUrl={data.hostAvatarUrl}
        objectRequest={data.objectRequest}
        rescheduleUrl={data.rescheduleUrl}
      />
    </>
  );
}
