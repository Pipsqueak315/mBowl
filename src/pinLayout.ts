// N9 (Phase 31A): the one copy of the pin triangle layout (PinDeck, FrameGrid
// mini decks, Stats leave rows). Each inner array is one display row, top to
// bottom, as 0-based pin indices (index = pin number - 1).
export const PIN_ROWS: readonly (readonly number[])[] = [
  [6, 7, 8, 9], // back row: pins 7, 8, 9, 10
  [3, 4, 5],    // middle row: pins 4, 5, 6
  [1, 2],       // front-middle: pins 2, 3
  [0],          // headpin: pin 1
];
