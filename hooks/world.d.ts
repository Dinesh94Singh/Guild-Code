// Types for world.js, the realm shared by the dry run and the mod.
import type { Point } from './pixelart.js'
export type Place = 'tavern' | 'study' | 'armory' | 'cauldron' | 'dungeon'
export declare const W: number
export declare const H: number
export declare const PLACES: Record<Place, { at: Point; tag: Point; spots: Point[] }>
export declare const HUB: Point
export declare const DOORWAY: Point
export declare const BOARD: Point
export declare const CAULDRON: Point
export declare const CHEST: Point
export declare const VOLCANO: Point
export declare const MONSTER_SLOTS: Point[]
/** Every road as drawn, by `from-to` crossroads. */
export declare const ROADS: Record<string, Point[]>
export declare const NODES: Record<string, Point>
export declare const EDGES: [string, string, [number, number][]][]
/** The shortest way along the roads from one place (or crossroads) to another, as points `step` apart. */
export declare function way(from: string, to: string, step?: number): Point[]
export declare const FALLS: { x: number; top: number; bottom: number }
export declare const WALK: Record<Place, Point[]>
export declare const RIVER: Point[]
export declare const FOLK: {
  mine: Point; woodyard: Point; cookfire: Point; laundry: Point; fishing: Point; windmill: Point; glade: Point; dock: Point; perch: Point; well: Point; stall: Point
  field: Point & { w: number; h: number }
  pen: Point & { rx: number; ry: number }
  lake: Point & { rx: number; ry: number }
  town: Point & { rx: number; ry: number }
  harbour: Point; keep: Point; hall: Point; ruins: Point
  houses: (Point & { w: number; roof: string[]; chimney: boolean })[]
  boats: Point[]
  lamps: Point[]
  townPoints: Point[]; catPoints: Point[]; chickens: Point[]; frogPads: Point[]; pools: Point[]
  fireflies: Point & { w: number; h: number }; butterflies: Point & { w: number; h: number }; flurries: Point & { w: number; h: number }
  gulls: (Point & { r: number; v: number })[]
  ship: { y: number; from: number; to: number }
}
