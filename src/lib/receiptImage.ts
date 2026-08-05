// Turns the on-screen receipt into an actual image file, so it can travel
// alongside the WhatsApp text message instead of the client only getting a
// sentence describing the payment. Best-effort: if capture fails (e.g. a
// cross-origin logo image without CORS headers), the caller falls back to
// the text-only message that already worked before this existed.
export async function captureNodeAsPngFile(
  node: HTMLElement,
  filename: string
): Promise<File> {
  const { toBlob } = await import("html-to-image");
  const blob = await toBlob(node, {
    pixelRatio: 2,
    backgroundColor: "#ffffff",
    cacheBust: true,
  });
  if (!blob) throw new Error("capture-failed");
  return new File([blob], filename, { type: "image/png" });
}
