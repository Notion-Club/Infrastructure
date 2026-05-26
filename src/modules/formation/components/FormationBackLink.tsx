"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { startLessonTransition } from "./LessonTransition";

export function FormationBackLink() {
  const router = useRouter();

  function go() {
    startLessonTransition();
    router.push("/formation");
  }

  return (
    <button
      type="button"
      onClick={go}
      style={{
        alignSelf: "flex-start",
        background: "none",
        border: "none",
        color: "var(--color-text-muted)",
        fontSize: 13,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        cursor: "pointer",
        padding: 0,
        font: "inherit",
      }}
    >
      <ArrowLeft size={14} /> Tous les programmes
    </button>
  );
}
