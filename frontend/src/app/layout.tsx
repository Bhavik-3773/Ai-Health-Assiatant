import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Health Assistant",
  description: "AI Powered Personalized Health Assistant",
};

// Runs before paint (blocking, in <head>) so the saved theme applies with
// no flash of the wrong theme. Mirrors the well-established next-themes
// pattern without adding a new dependency. Settings page is the only
// place that currently writes to `localStorage.theme`.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var theme = localStorage.getItem("theme");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen dark:bg-slate-950 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}