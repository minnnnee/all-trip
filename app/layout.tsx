import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tripwise — 여행 준비 도우미',
  description: '나라·도시·달·시기만 입력하면 날씨 요약, 옷차림 추천, 명소·맛집을 한 번에',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tripwise',
  },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    title: 'Tripwise — 여행 준비 도우미',
    description: '나라·도시·달·시기만 입력하면 날씨, 옷차림, 명소·맛집을 한 번에',
  },
};

export const viewport: Viewport = {
  themeColor: '#0ea5e9',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* iOS PWA 아이콘 */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="antialiased">
        {/* 모바일 앱처럼 중앙 최대 폭 제한 */}
        <div className="min-h-screen max-w-md mx-auto relative">
          {children}
        </div>
        {/* SW 등록 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
