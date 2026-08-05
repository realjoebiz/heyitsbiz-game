import type { Metadata, Viewport } from 'next';
import { ColorBlocksGame } from '@/components/ColorBlocksGame';

export const metadata: Metadata = {
  title: 'Color Blocks — game.heyitsbiz.com',
  description: 'Clear the 12×20 grid by matching adjacent coloured blocks.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0d0d18',
};

export default function GamePage() {
  return <ColorBlocksGame />;
}
