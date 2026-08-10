import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '点滴留言板',
  description: '留言、照片、时间胶囊与纪念日',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
