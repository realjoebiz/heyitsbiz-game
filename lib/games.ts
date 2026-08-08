export type GameMeta = {
  slug: string;
  title: string;
  blurb: string;
  accent: string;
  available: boolean;
};

/** Hub tiles — five large squares; only available games are clickable. */
export const GAMES: GameMeta[] = [
  {
    slug: 'color-blocks',
    title: 'Color Blocks',
    blurb: 'Clear matching groups — three colours, 12×20 grid.',
    accent: '#42a5f5',
    available: true,
  },
  {
    slug: 'decoy',
    title: 'Decoy',
    blurb: 'Memorise real numbers. Ignore everything else.',
    accent: '#ff7043',
    available: true,
  },
  {
    slug: 'realmino',
    title: 'Realmino',
    blurb: 'Online rooms — draft tiles, build kingdoms.',
    accent: '#66bb6a',
    available: true,
  },
  {
    slug: 'mirror',
    title: 'Mirror',
    blurb: 'Coming soon.',
    accent: '#ab47bc',
    available: false,
  },
  {
    slug: 'drift',
    title: 'Drift',
    blurb: 'Coming soon.',
    accent: '#ffca28',
    available: false,
  },
];

export function getGame(slug: string): GameMeta | undefined {
  return GAMES.find((g) => g.slug === slug);
}
