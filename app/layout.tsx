import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Games — game.heyitsbiz.com',
  description: 'Pick a game on game.heyitsbiz.com.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
