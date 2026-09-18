import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The whole tool is client-side canvas work, so there is nothing to
  // revalidate and no server runtime needed — this exports fine statically.
  // Uncomment to emit a plain static site into ./out:
  // output: "export",
};

export default nextConfig;
