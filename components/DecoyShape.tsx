import type { Colour, Shape } from '@/lib/decoy';
import { COLOUR_HEX } from '@/lib/decoy';

type Props = {
  shape: Shape;
  colour: Colour;
  size: number;
  className?: string;
};

export function DecoyShape({ shape, colour, size, className }: Props) {
  const fill = COLOUR_HEX[colour];
  const stroke = colour === 'white' ? '#333' : colour === 'yellow' ? '#8a6a00' : 'transparent';

  if (shape === 'circle') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
        <circle cx="50" cy="50" r="44" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  if (shape === 'triangle') {
    return (
      <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
        <polygon points="50,8 94,90 6,90" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  if (shape === 'rectangle') {
    return (
      <svg width={size} height={size * 0.72} viewBox="0 0 100 72" className={className} aria-hidden>
        <rect x="6" y="10" width="88" height="52" rx="2" fill={fill} stroke={stroke} strokeWidth="2" />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} aria-hidden>
      <rect x="12" y="12" width="76" height="76" rx="2" fill={fill} stroke={stroke} strokeWidth="2" />
    </svg>
  );
}
