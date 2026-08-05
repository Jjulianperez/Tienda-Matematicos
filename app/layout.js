import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/SmoothScroll";
import { CartProvider } from "@/context/CartContext";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata = {
  title: "MateMáticos - La fórmula del mate perfecto",
  description: "Descubrí la fórmula del mate perfecto. Mates, bombillas, termos y accesorios seleccionados con precisión matemática.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${spaceGrotesk.variable} antialiased`}>
      <body className="min-h-screen flex flex-col font-body">
        <CartProvider>
          <SmoothScroll>{children}</SmoothScroll>
        </CartProvider>
      </body>
    </html>
  );
}
