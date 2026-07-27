// Turn a DOM node into a shareable PNG and hand it to the OS share sheet (or a
// download as a fallback). Uses html2canvas, which is already bundled.

import html2canvas from "html2canvas";
import { track } from "@/lib/telemetry";

/** Rasterise a node to a PNG blob at @scale device pixels per CSS pixel. */
export async function nodeToPngBlob(node: HTMLElement, scale = 2): Promise<Blob | null> {
  const canvas = await html2canvas(node, {
    scale,
    backgroundColor: null,
    useCORS: true,
    logging: false,
  });
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

type ShareResult = "shared" | "downloaded" | "failed";

/**
 * Share the image via the Web Share API when the browser can share files,
 * otherwise trigger a download. Returns what actually happened.
 */
export async function shareOrDownload(
  blob: Blob,
  opts: { filename: string; title?: string; text?: string },
): Promise<ShareResult> {
  const file = new File([blob], opts.filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: unknown) => boolean };

  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: opts.title, text: opts.text });
      track("share_card", { method: "web_share" });
      return "shared";
    } catch (err) {
      // AbortError = user dismissed the sheet; treat as a no-op, not a download.
      if (err instanceof DOMException && err.name === "AbortError") return "failed";
      // Any other failure → fall through to download.
    }
  }

  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = opts.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    track("share_card", { method: "download" });
    return "downloaded";
  } catch {
    return "failed";
  }
}
