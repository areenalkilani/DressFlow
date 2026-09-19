"use client";

const MAX_EDGE = 1600;
const QUALITY = 0.82;

export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const source = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(source, 0, 0, width, height);
    source.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", QUALITY),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File(
      [blob],
      `${file.name.replace(/\.[^.]+$/, "") || "image"}.webp`,
      {
        type: "image/webp",
        lastModified: Date.now(),
      },
    );
  } catch {
    return file;
  }
}
