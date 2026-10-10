// Types for pixelart.js, the pixel art shared by the dry run and the mod.
export interface Pen { fillStyle: string; fillRect(x: number, y: number, w: number, h: number): void }
export type Point = { x: number; y: number }
export declare const hash: (x: number, y: number) => number
export declare const px: (b: Pen, c: string, x: number, y: number, w?: number, h?: number) => void
export declare class Recorder implements Pen {
  fillStyle: string
  fillRect(x: number, y: number, w: number, h: number): void
  /** What was drawn, as SVG paths: one per colour. */
  toSvg(): string
}
export declare function member(b: Pen, cls: string, frame: number, x?: number, y?: number, flip?: boolean, cape?: string): void
export declare function slime(b: Pen, kind: number, frame: number, x?: number, y?: number): void
export declare function villager(b: Pen, x: number, y: number, shirt: string, hair: string, step?: number): void
export declare function dragon(b: Pen, up: number): void
