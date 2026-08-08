import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ColorBlocksGame } from '@/components/ColorBlocksGame';
import { DecoyGame } from '@/components/DecoyGame';
import { RealminoGame } from '@/components/RealminoGame';
import { GAMES, getGame } from '@/lib/games';

type Props = { params: { gamename: string } };

export function generateStaticParams() {
  return GAMES.filter((g) => g.available).map((g) => ({ gamename: g.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const game = getGame(params.gamename);
  if (!game?.available) {
    return { title: 'Game not found — game.heyitsbiz.com' };
  }
  return {
    title: `${game.title} — game.heyitsbiz.com`,
    description: game.blurb,
  };
}

export default function GameRoutePage({ params }: Props) {
  const game = getGame(params.gamename);
  if (!game?.available) notFound();

  if (params.gamename === 'color-blocks') return <ColorBlocksGame />;
  if (params.gamename === 'decoy') return <DecoyGame />;
  if (params.gamename === 'realmino') return <RealminoGame />;

  notFound();
}
