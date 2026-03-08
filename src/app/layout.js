export const metadata = {
  title: "CERVEAU+",
  description: "Ton cerveau externe TDAH",
  manifest: "/manifest.json",
  themeColor: "#080810",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CERVEAU+",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CERVEAU+" />
        <meta name="theme-color" content="#080810" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body style={{ margin: 0, padding: 0, background: "#080810" }}>
        {children}
      </body>
    </html>
  );
}
