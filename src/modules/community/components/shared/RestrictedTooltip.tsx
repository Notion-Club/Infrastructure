"use client";

import { useState, useRef } from "react";

interface RestrictedTooltipProps {
  message: string;
  children: React.ReactNode;
}

export function RestrictedTooltip({ message, children }: RestrictedTooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#1a1a1a",
            color: "#fff",
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 8,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 300,
          }}
        >
          {message}
        </div>
      )}
    </div>
  );
}
