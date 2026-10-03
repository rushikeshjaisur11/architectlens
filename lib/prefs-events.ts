// "prefs:changed": the user picked a theme/text size (synced to the server). "prefs:applied": ProgressSync applied the server's values locally.
export type PrefsPatch = { theme?: string; textSize?: string };

export function announcePrefs(patch: PrefsPatch): void {
  window.dispatchEvent(new CustomEvent<PrefsPatch>("prefs:changed", { detail: patch }));
}
