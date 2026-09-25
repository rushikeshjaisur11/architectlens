const isCI = process.env.GITHUB_ACTIONS === "true";
const repoName = "architectlens";

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: isCI ? `/${repoName}` : "",
  assetPrefix: isCI ? `/${repoName}/` : "",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
