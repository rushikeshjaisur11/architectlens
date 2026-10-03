export const SITE_NAME = "architectlens";
// Public origin and base path come from next.config.mjs (environment-driven), so no host is hard-coded.
export const SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const SITE_URL = `${SITE_ORIGIN}${BASE_PATH}`;
// Set a contact address before launch; the Privacy and Terms pages show it when it is not empty.
export const CONTACT_EMAIL = "";
