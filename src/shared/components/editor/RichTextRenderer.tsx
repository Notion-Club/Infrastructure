// Server component — no "use client" needed, renders HTML from TipTap safely.
// Content always comes from our own TipTap editor (not user-typed raw HTML),
// so dangerouslySetInnerHTML is acceptable here.

interface RichTextRendererProps {
  html: string;
  // Optional extra inline styles on the wrapper
  style?: React.CSSProperties;
  className?: string;
}

export function RichTextRenderer({ html, style, className }: RichTextRendererProps) {
  return (
    <div
      className={`nc-prose${className ? ` ${className}` : ""}`}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: html }}
      style={style}
    />
  );
}

// Helper: checks whether a string looks like TipTap HTML output (starts with <)
// Used by renderers to distinguish old plain-text bodies from new HTML bodies.
export function isRichHtml(body: string): boolean {
  return body.trimStart().startsWith("<");
}
