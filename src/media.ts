/**
 * Media utilities for image compression and attachment preparation.
 *
 * All functions in this module are **browser-only** — they rely on the
 * Canvas API and File/Blob globals that are not available in Node.js.
 *
 * @see https://docs.textbubbles.com for full usage examples
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for {@link compressImage}. */
export interface CompressImageOptions {
  /** Maximum width or height in pixels (default: 4096) */
  maxDimension?: number;
  /** JPEG quality 0-1 (default: 0.85) */
  quality?: number;
  /** Output format (default: auto — JPEG for photos, PNG for transparency) */
  format?: "jpeg" | "png" | "auto";
}

/** Result returned by {@link compressImage}. */
export interface CompressedImage {
  /** Base64-encoded image data (without data URI prefix) */
  data: string;
  /** MIME type of the compressed image */
  mimeType: string;
  /** Original filename with updated extension */
  filename: string;
  /** Size in bytes of the compressed data */
  sizeBytes: number;
}

/** Options for {@link prepareAttachments}. */
export interface PrepareAttachmentsOptions extends CompressImageOptions {}

/** A single attachment ready to pass to `messages.send({ attachments })`. */
export interface PreparedAttachment {
  type: "base64";
  data: string;
  mimeType: string;
  filename: string;
}

// We use `any` casts to access browser-only DOM APIs without requiring
// "dom" in the project's tsconfig lib. All DOM access is guarded by the
// runtime `assertBrowser()` check.
/* eslint-disable @typescript-eslint/no-explicit-any */
const _global = globalThis as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertBrowser(): void {
  if (
    typeof _global.window === "undefined" ||
    typeof _global.document === "undefined" ||
    typeof _global.HTMLCanvasElement === "undefined"
  ) {
    throw new Error(
      "compressImage / prepareAttachments are browser-only utilities. " +
        "They require the Canvas API which is not available in Node.js. " +
        "See https://docs.textbubbles.com for server-side alternatives.",
    );
  }
}

// File type used for function signatures — resolves to the browser File
// global at runtime.
type BrowserFile = { name: string; type: string } & Blob;

/** Load a File into an HTMLImageElement. */
function loadImage(file: BrowserFile): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = _global.URL.createObjectURL(file);
    const img = new _global.Image();
    img.onload = () => {
      _global.URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      _global.URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    img.src = url;
  });
}

/** Replace (or append) the extension on a filename. */
function replaceExtension(filename: string, ext: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot === -1 ? filename : filename.slice(0, dot);
  return `${base}.${ext}`;
}

/** Detect whether an image has transparent pixels by sampling its alpha channel. */
function hasTransparency(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  width: number,
  height: number,
): boolean {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data: Uint8ClampedArray = imageData.data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 255) return true;
  }
  return false;
}

/** Convert a data URI to raw base64 and its MIME type. */
function parseDataUrl(dataUrl: string): { data: string; mimeType: string } {
  const commaIndex = dataUrl.indexOf(",");
  const header = dataUrl.slice(0, commaIndex);
  const data = dataUrl.slice(commaIndex + 1);
  const mimeType = header.match(/:(.*?);/)?.[1] ?? "application/octet-stream";
  return { data, mimeType };
}

/** Read a File as a base64 data URI. */
function readAsDataUrl(file: BrowserFile): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new _global.FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compress a browser `File` image using the Canvas API.
 *
 * The image is resized (preserving aspect ratio) if it exceeds
 * `maxDimension`, then re-encoded as JPEG or PNG. When `format` is `"auto"`
 * (the default), PNG is used for images with transparency and JPEG for
 * everything else.
 *
 * If the canvas pipeline fails (e.g. for HEIC files the browser cannot
 * decode), the original file bytes are returned as raw base64 without
 * compression.
 *
 * **Browser-only** — throws if called in Node.js.
 *
 * @see https://docs.textbubbles.com for full examples
 */
export async function compressImage(
  file: File,
  options?: CompressImageOptions,
): Promise<CompressedImage> {
  assertBrowser();

  const maxDimension = options?.maxDimension ?? 4096;
  const quality = options?.quality ?? 0.85;
  const format = options?.format ?? "auto";

  try {
    const img = await loadImage(file);

    // Compute target dimensions
    let { width, height } = img;
    if (width > maxDimension || height > maxDimension) {
      const scale = maxDimension / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = _global.document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, width, height);

    // Decide output format
    let outputFormat: "jpeg" | "png";
    if (format === "auto") {
      const transparent = hasTransparency(ctx, width, height);
      outputFormat = transparent ? "png" : "jpeg";
    } else {
      outputFormat = format;
    }

    const mimeType = `image/${outputFormat}`;
    const dataUrl: string = canvas.toDataURL(
      mimeType,
      outputFormat === "jpeg" ? quality : undefined,
    );
    const { data } = parseDataUrl(dataUrl);

    const ext = outputFormat === "jpeg" ? "jpg" : "png";
    const filename = replaceExtension(file.name, ext);
    const sizeBytes = Math.ceil((data.length * 3) / 4);

    return { data, mimeType, filename, sizeBytes };
  } catch {
    // Fallback: return the raw file as base64 without compression
    const dataUrl = await readAsDataUrl(file);
    const { data, mimeType } = parseDataUrl(dataUrl);
    const sizeBytes = Math.ceil((data.length * 3) / 4);

    return { data, mimeType, filename: file.name, sizeBytes };
  }
}

/**
 * Convert a browser `File` to base64 without any compression.
 *
 * **Browser-only** — throws if called in Node.js.
 *
 * @see https://docs.textbubbles.com for full examples
 */
export async function fileToBase64(
  file: File,
): Promise<{ data: string; mimeType: string }> {
  assertBrowser();

  const dataUrl = await readAsDataUrl(file);
  return parseDataUrl(dataUrl);
}

/**
 * Compress an array of image `File` objects and return them in the format
 * expected by `messages.send({ attachments: [...] })`.
 *
 * Non-image files are converted to base64 without compression.
 *
 * **Browser-only** — throws if called in Node.js.
 *
 * @see https://docs.textbubbles.com for full examples
 */
export async function prepareAttachments(
  files: File[],
  options?: PrepareAttachmentsOptions,
): Promise<PreparedAttachment[]> {
  assertBrowser();

  return Promise.all(
    files.map(async (file): Promise<PreparedAttachment> => {
      if (file.type.startsWith("image/")) {
        const compressed = await compressImage(file, options);
        return {
          type: "base64",
          data: compressed.data,
          mimeType: compressed.mimeType,
          filename: compressed.filename,
        };
      }

      // Non-image files: pass through as raw base64
      const { data, mimeType } = await fileToBase64(file);
      return {
        type: "base64",
        data,
        mimeType,
        filename: file.name,
      };
    }),
  );
}
