// Build-time stub for `next/image`: the real component validates remote src
// hostnames against next.config (absent in the preview bundle) and throws
// "hostname not configured", which renders the host component blank. A plain
// <img> renders the same pixels for a static preview.
import React from "react";
export default function Image({ src, alt, width, height, fill, style, className, sizes, priority, quality, placeholder, loader, ...rest }: any) {
  const s = typeof src === "string" ? src : (src && (src.src || src.default?.src)) || "";
  const st = fill
    ? { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", ...style }
    : style;
  return <img src={s} alt={alt || ""} width={fill ? undefined : width} height={fill ? undefined : height} style={st} className={className} {...rest} />;
}
