import type { ReactNode } from "react";
import { Header } from "@/components/header";

export const metadata = { title: "Pantry" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Header />
        <main>{children}</main>
      </body>
    </html>
  );
}
