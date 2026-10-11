// Theme packs: each season's wares, gathered for the merchant (hooks/treasury.ts). A pack adds
// its own file here and one line below; its art lives beside it in art.js.
import type { Ware } from '../treasury'
import { THANKSGIVING_WARES } from './thanksgiving'

export const PACK_WARES: Ware[] = [...THANKSGIVING_WARES]
