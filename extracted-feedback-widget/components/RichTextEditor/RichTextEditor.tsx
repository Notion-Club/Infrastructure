"use client";

import { useRef, useEffect, useCallback } from "react";
import { Bold, Italic, List, ListOrdered, Minus } from "lucide-react";
import styles from "./RichTextEditor.module.css";

interface RichTextEditorProps {
  name?: string;
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({
  name,
  value = "",
  onChange,
  placeholder = "Rédigez votre article ici...",
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (editorRef.current && !mounted.current) {
      editorRef.current.innerHTML = value;
      mounted.current = true;
    }
  }, [value]);

  const emit = useCallback(() => {
    const html = editorRef.current?.innerHTML ?? "";
    if (hiddenRef.current) hiddenRef.current.value = html;
    onChange?.(html);
  }, [onChange]);

  const exec = useCallback(
    (command: string, arg?: string) => {
      editorRef.current?.focus();
      document.execCommand(command, false, arg ?? "");
      emit();
    },
    [emit]
  );

  function isActive(command: string) {
    try { return document.queryCommandState(command); } catch { return false; }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar} role="toolbar" aria-label="Mise en forme du texte">
        <button
          type="button"
          className={`${styles.toolBtn} ${isActive("bold") ? styles.toolBtnActive : ""}`}
          onMouseDown={(e) => { e.preventDefault(); exec("bold"); }}
          title="Gras"
          aria-label="Gras"
        >
          <Bold size={14} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${isActive("italic") ? styles.toolBtnActive : ""}`}
          onMouseDown={(e) => { e.preventDefault(); exec("italic"); }}
          title="Italique"
          aria-label="Italique"
        >
          <Italic size={14} strokeWidth={2} />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button
          type="button"
          className={styles.toolBtn}
          onMouseDown={(e) => { e.preventDefault(); exec("insertUnorderedList"); }}
          title="Liste à puces"
          aria-label="Liste à puces"
        >
          <List size={15} strokeWidth={1.5} />
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onMouseDown={(e) => { e.preventDefault(); exec("insertOrderedList"); }}
          title="Liste numérotée"
          aria-label="Liste numérotée"
        >
          <ListOrdered size={15} strokeWidth={1.5} />
        </button>
        <span className={styles.divider} aria-hidden="true" />
        <button
          type="button"
          className={styles.toolBtn}
          onMouseDown={(e) => { e.preventDefault(); exec("insertHorizontalRule"); }}
          title="Séparateur"
          aria-label="Séparateur"
        >
          <Minus size={15} strokeWidth={1.5} />
        </button>
      </div>

      <div
        ref={editorRef}
        className={styles.editor}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder={placeholder}
        aria-label="Corps de l'article"
        aria-multiline="true"
        role="textbox"
      />

      {name && <input ref={hiddenRef} type="hidden" name={name} defaultValue={value} />}
    </div>
  );
}
