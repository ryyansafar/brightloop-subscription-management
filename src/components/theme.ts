export type Theme = "light" | "dark" | "system";
export const THEME_KEY = "brightloop-theme";

export function parseTheme(value: string | null): Theme {
  return value === "light" || value === "dark" ? value : "system";
}

// Run before the page paints. Only the root theme attribute changes before hydration.
export const themeScript = `try{var t=localStorage.getItem('${THEME_KEY}');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:'system'}catch{}`;
