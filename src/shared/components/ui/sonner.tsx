"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-right"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" style={{ color: "#16a34a" }} />
        ),
        info: (
          <InfoIcon
            className="size-4"
            style={{ color: "var(--color-text-secondary)" }}
          />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" style={{ color: "#d97706" }} />
        ),
        error: (
          <OctagonXIcon
            className="size-4"
            style={{ color: "var(--color-brand)" }}
          />
        ),
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          // Alignés sur le design system NotionClub (tokens surface/border/text)
          // plutôt que le fond générique sombre par défaut de Sonner.
          "--normal-bg": "var(--color-surface-card)",
          "--normal-text": "var(--color-text-primary)",
          "--normal-border": "var(--color-border-default)",
          "--border-radius": "14px",
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          boxShadow: "var(--nc-shadow-2)",
          borderRadius: "14px",
          padding: "14px 16px",
          fontFamily: "inherit",
          fontSize: "14px",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
