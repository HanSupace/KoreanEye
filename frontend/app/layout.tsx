import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "한글탐정단 | 탐정의 학습 노트",
  description: "내 글이 나만의 맞춤 문제집이 되는 한글 학습 서비스",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
