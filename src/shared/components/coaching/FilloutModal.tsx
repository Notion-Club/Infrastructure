"use client";

import { useEffect } from "react";
import { MacOSWindowBar } from "@/shared/components/ui/MacOSWindowBar";

interface FilloutModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  userEmail: string;
  memberId: string;
}

export function FilloutModal({
  isOpen,
  onClose,
  url,
  userEmail,
  memberId,
}: FilloutModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const iframeUrl = `${url}?email=${encodeURIComponent(userEmail)}&member_id=${encodeURIComponent(memberId)}`;

  function handleOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        padding: "16px",
      }}
    >
      {/* Modal window */}
      <div
        style={{
          width: "100%",
          maxWidth: 700,
          maxHeight: "85vh",
          background: "#ffffff",
          borderRadius: 12,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "nc-modal-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      >
        <MacOSWindowBar onClose={onClose} />

        <iframe
          src={iframeUrl}
          width="100%"
          height="100%"
          frameBorder={0}
          style={{
            display: "block",
            flex: 1,
            minHeight: 560,
            border: "none",
          }}
          title="Formulaire de réservation"
        />
      </div>
    </div>
  );
}
