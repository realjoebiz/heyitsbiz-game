import type { Metadata, Viewport } from 'next';
import { GameHub } from '@/components/GameHub';

export const metadata: Metadata = {
  title: 'Games — game.heyitsbiz.com',
  description: 'Pick a game. Color Blocks, Decoy, and more.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0d0d18',
};

export default function HubPage() {
  return <GameHub />;
}
