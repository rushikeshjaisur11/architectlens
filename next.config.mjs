// Deployment is configured by environment, so the same code runs on any host:
//  - default (Vercel, Node, Docker): a normal Next.js server build at the site root;
//  - GitHub Pages (GITHUB_ACTIONS) or STATIC_EXPORT=true: a static export, with the Pages base path when needed.
// Set NEXT_PUBLIC_SITE_URL to the public origin (for example https://architectlens.com) on production builds.
const onGithubPages = process.env.GITHUB_ACTIONS === "true";
const staticExport = onGithubPages || process.env.STATIC_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (onGithubPages ? "/architectlens" : "");
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? (onGithubPages ? "https://rushikeshjaisur11.github.io" : "http://localhost:3000");

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  basePath,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  trailingSlash: true,
  images: { unoptimized: staticExport },
  env: { NEXT_PUBLIC_SITE_URL: siteUrl, NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
