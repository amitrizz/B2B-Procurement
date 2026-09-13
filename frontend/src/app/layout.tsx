import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import CentrifugoProvider from "@/components/CentrifugoProvider";

const poppins = Poppins({ 
  subsets: ["latin"],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-poppins'
});

export const metadata: Metadata = {
  title: "Kantech | B2B Procurement Platform",
  description: "Kantech component-level B2B procurement platform.",
  applicationName: "Kantech",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Kantech"
  }
};

export const viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full dark bg-slate-950 text-slate-100">
      <body className={`${poppins.variable} min-h-full flex flex-col`}>
        <CentrifugoProvider>
          {children}
        </CentrifugoProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(
                    function(reg) { console.log('PWA ServiceWorker registered'); },
                    function(err) { console.log('PWA ServiceWorker registration failed: ', err); }
                  );
                });
              }
            `
          }}
        />
      </body>
    </html>
  );
}
