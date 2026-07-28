import "./globals.css";

export const metadata = {
  title: "국내 수입 주류 대시보드",
  description: "관세청 품목별 수출입실적(nitemtrade) 기반 수입주류 대시보드",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
