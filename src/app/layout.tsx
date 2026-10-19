import type { Metadata } from "next";
import { ScrollAtmosphere } from "@/components/scroll-atmosphere";
import "@fontsource-variable/archivo";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "Vereador Junior Coringa | Campo Grande - MS",
    template: "%s | Junior Coringa",
  },
  description: "Acompanhe o mandato, os projetos e as notícias do vereador Junior Coringa em Campo Grande, Mato Grosso do Sul.",
  icons: { icon: "/favicon.png" },
  openGraph: {
    title: "Vereador Junior Coringa",
    description: "Trabalho, presença e compromisso com Campo Grande.",
    locale: "pt_BR",
    type: "website",
    images: ["/images/logo-junior-coringa.webp"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <ScrollAtmosphere />
        {children}
      </body>
    </html>
  );
}
