export const SITE_NAME = "architectlens";
// Public origin and base path come from next.config.mjs (environment-driven), so no host is hard-coded.
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}`;

// Owner and contact details shown on the About, Privacy and Terms pages and in the footer.
export const OWNER_NAME = "Rushikesh Jaisur";
export const CONTACT_EMAIL = "rushikeshjaisur11@gmail.com";
export const GITHUB_URL = "https://github.com/rushikeshjaisur11";
