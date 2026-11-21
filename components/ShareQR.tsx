"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR code pointing at the citizen screener — for posters, slides, and judges scanning on stage. */
export default function ShareQR({ size = 168 }: { size?: number }) {
  const [src, setSrc] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/screen`;
    setUrl(u);
    QRCode.toDataURL(u, { margin: 1, width: size * 2, color: { dark: "#1b2422", light: "#ffffff" } }).then(setSrc).catch(() => {});
  }, [size]);
  if (!src) return <div style={{ width: size, height: size }} className="rounded-xl bg-line" />;
  return (
    <figure className="inline-flex flex-col items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} width={size} height={size} alt={`QR code ไปที่ ${url}`} className="rounded-xl bg-white p-2 shadow-sm" />
      <figcaption className="text-xs text-muted">{url.replace(/^https?:\/\//, "")}</figcaption>
    </figure>
  );
}
