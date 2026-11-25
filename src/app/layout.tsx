import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KucAI",
  description: "Asisten AI KucAI dengan pilihan provider yang fleksibel.",
  applicationName: "KucAI",
  icons: {
    icon: "/kucai_logo.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      data-theme="light"
      suppressHydrationWarning
    >
      <body className="flex flex-col">
        {children}
        <Script
          id="kucai-display-preferences"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var l=localStorage.getItem("kucai-language-v1");if(l==="id"||l==="en")document.documentElement.lang=l;var t=localStorage.getItem("kucai-theme-v1");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`,
          }}
        />
      </body>
    </html>
  );
}
