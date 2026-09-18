/* Single source of truth for SEO copy. The visible FAQ and the FAQPage
   JSON-LD are both generated from FAQ below, so they cannot drift apart —
   Google requires them to match. */

/** Set NEXT_PUBLIC_SITE_URL in .env.local (or your host's env) before deploying. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://example.com"
).replace(/\/$/, "");

export const SITE_NAME = "Rescale";

export const SITE_TITLE =
  "Image Resizer — Resize, Upscale & Remove Background, Free";

export const SITE_DESCRIPTION =
  "Free online image resizer. Resize by pixels, percentage or preset, upscale up to 4×, and remove backgrounds — right in your browser. No signup, no watermark, no uploads.";

export const SOCIAL_DESCRIPTION =
  "Resize, upscale and cut out image backgrounds right in your browser. Free, private, no uploads.";

export const KEYWORDS = [
  "image resizer",
  "resize image",
  "resize image online",
  "image upscaler",
  "upscale image",
  "remove background",
  "resize photo",
  "resize image in kb",
  "bulk image resizer",
  "resize image for instagram",
];

export const FEATURE_LIST = [
  "Resize images by pixel dimensions, percentage or preset size",
  "Lock aspect ratio; fit, fill or stretch to a target size",
  "Upscale images 2×, 3× or 4× with Lanczos resampling and sharpening",
  "Remove a solid or gradient background and export transparency",
  "Export as JPG, PNG or WebP with a quality control",
  "Runs entirely in the browser — images are never uploaded",
];

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ: FaqItem[] = [
  {
    q: "Are my images uploaded to a server?",
    a: "No. Every image is decoded, resized and re-encoded by your own browser using the HTML5 Canvas API. Nothing is sent to a server, so there is no upload wait and nothing is stored or logged.",
  },
  {
    q: "How do I resize an image without losing quality?",
    a: "Keep the aspect-ratio lock on so the image is not stretched, shrink in one step rather than several, and export as PNG or WebP for graphics or high-quality JPG (85–92) for photos. Rescale also uses progressive downscaling for large reductions, which keeps edges clean.",
  },
  {
    q: "Can I resize an image to a specific file size?",
    a: "Yes, indirectly. Reduce the pixel dimensions and lower the JPG or WebP quality slider while watching the live output-size readout, which shows the exact encoded size and the percentage saved. Adjust until you are under your target KB or MB.",
  },
  {
    q: "Is this image resizer free?",
    a: "Yes. It is completely free with no account, no sign-up, no watermark and no limit on how many images you process.",
  },
  {
    q: "Can I make an image larger without it becoming blurry?",
    a: "Use the Upscale tool. It enlarges 2×, 3× or 4× with Lanczos-3 resampling plus an unsharp-mask pass, which stays much sharper than a normal browser resize. It does not invent new detail the way an AI model would, but results are clean for moderate enlargements.",
  },
  {
    q: "How do I remove a white background from an image?",
    a: "Open the Cut out tool. It auto-detects the background colour from the image edges, or you can pick the colour with the eyedropper. Adjust Tolerance and Edge softness, then export as PNG or WebP to keep the transparency. It works best on plain or gradient backgrounds.",
  },
  {
    q: "What image formats are supported?",
    a: "You can open JPG, PNG, WebP and GIF files, and export as JPG, PNG or WebP. If your browser cannot encode WebP, Rescale falls back to PNG automatically.",
  },
  {
    q: "Does it work on mobile?",
    a: "Yes. The layout adapts to phones and tablets, and processing runs on the device. Very large upscales are slower on mobile hardware but still work.",
  },
];

export function webApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Rescale Image Resizer",
    url: `${SITE_URL}/`,
    description:
      "Free browser-based tool to resize, upscale and remove the background from images. All processing happens on the user's device — no uploads.",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Any (modern web browser)",
    browserRequirements: "Requires JavaScript and HTML5 Canvas",
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: FEATURE_LIST,
    creator: { "@type": "Organization", name: SITE_NAME, url: `${SITE_URL}/` },
  };
}

export function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
