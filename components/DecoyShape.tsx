import type { Colour, Shape } from '@/lib/decoy';
import { COLOUR_HEX, contrastOutline } from '@/lib/decoy';

type Props = {
  shape: Shape;
  colour: Colour;
  /** Pixel size, or omit when sizing via CSS (e.g. 75% large shape). */
  size?: number;
  className?: string;
};

export function DecoyShape({ shape, colour, size, className }: Props) {
  const fill = COLOUR_HEX[colour];
  const stroke = contrastOutline(colour);
  const strokeW = 5;
  const dim = size ?? undefined;
  const style = size
    ? undefined
    : ({ width: '100%', height: '100%' } as const);

  if (shape === 'circle') {
    return (
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 100 100"
        className={className}
        style={style}
        aria-hidden
      >
        <circle cx="50" cy="50" r="44" fill={fill} stroke={stroke} strokeWidth={strokeW} />
      </svg>
    );
  }

  if (shape === 'triangle') {
    return (
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 100 100"
        className={className}
        style={style}
        aria-hidden
      >
        <polygon
          points="50,8 94,90 6,90"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (shape === 'rectangle') {
    return (
      <svg
        width={dim}
        height={dim ? size! * 0.72 : dim}
        viewBox="0 0 100 72"
        className={className}
        style={style}
        aria-hidden
      >
        <rect
          x="6"
          y="10"
          width="88"
          height="52"
          rx="2"
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeW}
        />
      </svg>
    );
  }

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      aria-hidden
    >
      <rect
        x="12"
        y="12"
        width="76"
        height="76"
        rx="2"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeW}
      />
    </svg>
  );
}
