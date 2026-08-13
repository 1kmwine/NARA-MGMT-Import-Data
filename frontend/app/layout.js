import localFont from "next/font/local";
import "./globals.css";

// Self-hosted via next/font so the bundle lands under /_next/static (basePath-aware)
// and works whether the app is served at root or under /NID/import-data.
const pretendard = localFont({
  src: "./fonts/PretendardVariable.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-pretendard",
});

export const metadata = {
  title: "국내 수입 주류 대시보드",
  description: "관세청 품목별 수출입실적(nitemtrade) 기반 수입주류 대시보드",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
