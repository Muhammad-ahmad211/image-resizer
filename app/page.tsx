import { BrandMark, ShieldIcon } from "@/components/Icons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ToolApp } from "@/components/ToolApp";
import { FAQ } from "@/lib/site";

export default function Home() {
  return (
    <>
      <header className="topbar" id="top">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span className="brand-text">
            <b>Rescale</b>
            <i>darkroom for the browser</i>
          </span>
        </div>
        <div className="topbar-actions">
          <span className="privacy-pill" title="Images never leave this device">
            <ShieldIcon />
            100% on-device
          </span>
          <ThemeToggle />
        </div>
      </header>

      <div className="layout">
        {/* Ad rails appear at >=1240px and collapse once an image is loaded.
            To monetise, drop your <ins class="adsbygoogle"> unit into .ad-slot
            and load the AdSense script with next/script in app/layout.tsx. */}
        <aside className="ad-rail ad-rail--left" aria-hidden="true">
          <div className="ad-slot" />
        </aside>

        <main className="stage-wrap">
          <ToolApp />
        </main>

        <aside className="ad-rail ad-rail--right" aria-hidden="true">
          <div className="ad-slot" />
        </aside>
      </div>

      {/* ===== Indexable content — server-rendered, no JS required ===== */}
      <section className="page-copy" id="about">
        <div className="copy-wrap">
          <h1>Free online image resizer</h1>
          <p className="lede">
            Resize, upscale and remove the background from your photos in seconds — entirely in
            your browser. There is no account, no watermark and no upload: every pixel is
            processed on your own device with the HTML5 Canvas API, so your images never touch a
            server.
          </p>

          <h2 id="how-to">How to resize an image online</h2>
          <ol className="steps">
            <li>
              <strong>Add your image.</strong> Drag a file onto the page, click to browse, or
              paste from the clipboard with <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>V</kbd>. JPG, PNG,
              WebP and GIF are all supported.
            </li>
            <li>
              <strong>Choose a size.</strong> Enter width and height in pixels, scale by
              percentage, or pick a ready-made size such as 1920×1080 or a square profile picture.
              Keep the lock on to hold the aspect ratio.
            </li>
            <li>
              <strong>Set the output.</strong> Export as JPG, PNG or WebP and use the quality
              slider while the live readout shows the exact new file size and how much smaller it
              is.
            </li>
            <li>
              <strong>Download.</strong> Save the result, or copy it straight to your clipboard.
            </li>
          </ol>

          <h2>Three tools in one</h2>

          <h3>Resize by pixels, percentage or preset</h3>
          <p>
            Set exact dimensions with an aspect-ratio lock, scale by a percentage, or choose from
            presets for screens, social media and avatars. When the target shape differs from the
            original you can fit (letterbox), fill (centre-crop) or stretch. Large reductions use
            progressive downscaling so edges stay crisp.
          </p>

          <h3>Upscale images up to 4×</h3>
          <p>
            Enlarge a small image 2×, 3× or 4× with Lanczos-3 resampling and an unsharp-mask pass,
            plus optional noise reduction. It produces a noticeably sharper result than a plain
            browser resize — ideal for thumbnails, old photos and low-resolution graphics.
          </p>

          <h3>Remove an image background</h3>
          <p>
            Cut out a solid or gradient background with a colour key: the tool auto-detects the
            background from the image edges, or you can sample it with the eyedropper. Tune
            tolerance and edge softness, clean the colour fringe, then export a transparent PNG or
            WebP — or drop in a new background colour.
          </p>

          <h2>Private by design</h2>
          <p>
            Most online image tools upload your file, process it on their servers and keep it for
            some period of time. Rescale does none of that. The page is statically rendered and
            every tool runs client-side; there is no backend, no analytics and no cookies.
          </p>

          <h2 id="faq">Frequently asked questions</h2>
          {/* Same source as the FAQPage JSON-LD in app/layout.tsx, which Google
              requires to match the visible text. */}
          {FAQ.map((item) => (
            <div key={item.q}>
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="footer">
        <nav className="footer-nav" aria-label="Page sections">
          <a href="#top">Tool</a>
          <a href="#how-to">How&nbsp;to</a>
          <a href="#faq">FAQ</a>
          <a href="#about">About</a>
        </nav>
        <p className="footer-note">
          Rescale runs entirely in your browser using the Canvas API — no servers, no tracking, no
          uploads.
        </p>
        <p className="footer-copy">
          © {new Date().getFullYear()} Rescale. Platform names are trademarks of their respective
          owners and are used only to describe image sizes.
        </p>
      </footer>
    </>
  );
}
