import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Color Blocks — game.heyitsbiz.com',
  description: 'Clear the 12×20 grid by matching adjacent coloured blocks.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
