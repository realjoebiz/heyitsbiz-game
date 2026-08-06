export const COLOURS = [
  'black',
  'white',
  'green',
  'blue',
  'yellow',
  'orange',
  'red',
  'purple',
] as const;

export const SHAPES = ['circle', 'triangle', 'square', 'rectangle'] as const;

export type Colour = (typeof COLOURS)[number];
export type Shape = (typeof SHAPES)[number];

export type DecoySquare = {
  real_number: number;
  background_colour: Colour;
  large_shape: Shape;
  large_shape_colour: Colour;
  text_shape: Shape;
  text_shape_colour: Colour;
  /** Written colour word (e.g. GREEN). */
  text_colour: Colour;
  /** Font colour for that word — random, not necessarily matching the word. */
  text_colour_font_colour: Colour;
  inner_shape: Shape;
  inner_shape_colour: Colour;
  decoy_number: number;
  decoy_number_colour: Colour;
};

export type AskField =
  | 'inner_shape'
  | 'inner_shape_colour'
  | 'text_shape'
  | 'text_shape_colour'
  | 'text_colour'
  | 'text_colour_font_colour'
  | 'large_shape'
  | 'large_shape_colour'
  | 'background_colour'
  | 'decoy_number';

export type QuestionPart = {
  realNumber: number;
  field: AskField;
  answer: string;
};

export type DecoyQuestion = {
  parts: [QuestionPart, QuestionPart];
  prompt: string;
  expected: string;
};

const FIELD_LABEL: Record<AskField, string> = {
  inner_shape: 'INNER SHAPE',
  inner_shape_colour: 'INNER SHAPE COLOUR',
  text_shape: 'TEXT SHAPE',
  text_shape_colour: 'TEXT SHAPE COLOUR',
  text_colour: 'TEXT COLOUR',
  text_colour_font_colour: 'TEXT COLOUR FONT',
  large_shape: 'LARGE SHAPE',
  large_shape_colour: 'LARGE SHAPE COLOUR',
  background_colour: 'BACKGROUND COLOUR',
  decoy_number: 'DECOY NUMBER',
};

const ASK_FIELDS: AskField[] = [
  'inner_shape',
  'inner_shape_colour',
  'text_shape',
  'text_shape_colour',
  'text_colour',
  'text_colour_font_colour',
  'large_shape',
  'large_shape_colour',
  'background_colour',
  'decoy_number',
];

export const COLOUR_HEX: Record<Colour, string> = {
  black: '#111111',
  white: '#f5f5f5',
  green: '#2e7d32',
  blue: '#1565c0',
  yellow: '#f9a825',
  orange: '#ef6c00',
  red: '#c62828',
  purple: '#6a1b9a',
};

/** Outline that stays readable on a matching fill/background. */
export function contrastOutline(colour: Colour): string {
  return colour === 'white' || colour === 'yellow' ? '#111111' : '#ffffff';
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function answerFor(square: DecoySquare, field: AskField): string {
  const v = square[field];
  return String(v).toUpperCase();
}

export function newDecoyRound(): { squares: DecoySquare[]; question: DecoyQuestion } {
  const realNums = shuffle([1, 2, 3, 4, 5]);
  const decoyNums = shuffle([1, 2, 3, 4, 5]);

  const squares: DecoySquare[] = realNums.map((real_number, i) => ({
    real_number,
    background_colour: pick(COLOURS),
    large_shape: pick(SHAPES),
    large_shape_colour: pick(COLOURS),
    text_shape: pick(SHAPES),
    text_shape_colour: pick(COLOURS),
    text_colour: pick(COLOURS),
    text_colour_font_colour: pick(COLOURS),
    inner_shape: pick(SHAPES),
    inner_shape_colour: pick(COLOURS),
    decoy_number: decoyNums[i]!,
    decoy_number_colour: pick(COLOURS),
  }));

  // Display order left-to-right by position; identity is real_number
  const byReal = new Map(squares.map((s) => [s.real_number, s]));
  const pickTwoReals = shuffle([1, 2, 3, 4, 5]).slice(0, 2) as [number, number];
  const fields = shuffle([...ASK_FIELDS]).slice(0, 2) as [AskField, AskField];

  const parts: [QuestionPart, QuestionPart] = [
    {
      realNumber: pickTwoReals[0],
      field: fields[0],
      answer: answerFor(byReal.get(pickTwoReals[0])!, fields[0]),
    },
    {
      realNumber: pickTwoReals[1],
      field: fields[1],
      answer: answerFor(byReal.get(pickTwoReals[1])!, fields[1]),
    },
  ];

  const prompt = `ENTER THE ${FIELD_LABEL[parts[0].field]} OF SQUARE ${parts[0].realNumber} AND THE ${FIELD_LABEL[parts[1].field]} OF SQUARE ${parts[1].realNumber}`;
  const expected = `${parts[0].answer} ${parts[1].answer}`;

  return { squares, question: { parts, prompt, expected } };
}

export function normalizeAnswer(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ');
}

export function checkAnswer(raw: string, expected: string): boolean {
  return normalizeAnswer(raw) === normalizeAnswer(expected);
}
