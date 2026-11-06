import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pratikshya Kitchen Suppliers — Lucky Spin Event',
  description: 'One-Day Exclusive Promotional Lucky Spin in Pokhara, Nepal',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-900 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}

