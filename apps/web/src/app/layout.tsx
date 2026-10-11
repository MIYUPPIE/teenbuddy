import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "../lib/store.tsx";
import { Tabs } from "../components/Tabs.tsx";
import { THEME_SCRIPT } from "../lib/theme.ts";

export const metadata: Metadata = {
  title: "TeenBuddy",
  description:
    "A private daily companion: understand how you feel, handle hard moments, build good habits, and reach someone you trust.",
  // A teenager's app should not turn up in someone else's search results.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Without this, env(safe-area-inset-*) resolves to 0 on iOS and the fixed tab
  // bar sits under the home indicator.
  viewportFit: "cover",
  // A single tag rather than two media-scoped ones: the theme can now be
  // overridden by the user, so `applyTheme` rewrites this at runtime and a
  // media-scoped pair would fight it.
  themeColor: "#fafaf7",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before first paint. Without it a teen who chose Night gets a
            full-brightness white flash before hydration corrects it - at 1am,
            which is exactly when this app gets opened. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <StoreProvider>
          <main>{children}</main>
          <Tabs />
        </StoreProvider>
      </body>
    </html>
  );
}
