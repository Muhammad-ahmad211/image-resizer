import type { Dimensions, ToolId } from "./types";

export function extFor(type: string): string {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  return type?.split("/")[1] || "png";
}

export function shortType(type: string): string {
  return (type?.split("/")[1] || "png").toUpperCase();
}

/** e.g. `beach-photo-1920x1080-upscaled-2x.jpg` */
export function outputFilename(
  sourceName: string | undefined,
  target: Dimensions,
  tool: ToolId,
  mimeType: string,
  upscaleFactor: number,
): string {
  const base =
    (sourceName || "image")
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "image";

  const suffix =
    tool === "upscale" ? `-upscaled-${upscaleFactor}x` : tool === "removebg" ? "-nobg" : "";

  return `${base}-${target.width}x${target.height}${suffix}.${extFor(mimeType)}`;
}
