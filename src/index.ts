// Public library entrypoint — types + client

export { VintedClient } from './client/session.js';
export type { VintedClientOptions } from './client/session.js';

export type {
  Country,
  Condition,
  SortBy,
  SearchParams,
  Item,
  SearchResult,
  ItemDetail,
  Seller,
  CategoryHit,
} from './client/types.js';

export {
  COUNTRIES,
  DOMAIN,
  CONDITION_ID,
  SORT_VALUE
} from './client/types.js';

export type {
  BrandHit,
  ItemSlim,
  FeedbackEntry,
  FeedbackResult,
  ColorHit,
  SizeEntry,
  SizeGroup
} from './client/endpoints.js';

export { opSearch, opSearchAll } from './ops/search.js';
export { opGetItem } from './ops/get-item.js';
export { opGetSeller } from './ops/get-seller.js';
export { opCompare } from './ops/compare.js';
export { opTrending } from './ops/trending.js';
export { opBrands, resolveBrandIds } from './ops/brands.js';
export { opCategories } from './ops/categories.js';
export { opSellerItems } from './ops/seller-items.js';
export { opGetSellerFeedback } from './ops/get-seller-feedback.js';
export { opGetColors } from './ops/get-colors.js';
export { opGetSizeGroups } from './ops/get-size-groups.js';

// MCP-friendly aliases expected by server.mjs
export { opSearch as searchItems } from './ops/search.js';
export { opGetItem as getItem } from './ops/get-item.js';
export { opGetSeller as getSeller } from './ops/get-seller.js';
export { opCompare as comparePrices } from './ops/compare.js';
export { opTrending as getTrending } from './ops/trending.js';

// Optional extra aliases if you want more MCP tools later
export { opBrands as getBrands } from './ops/brands.js';
export { opCategories as getCategories } from './ops/categories.js';
export { opSellerItems as getSellerItems } from './ops/seller-items.js';
export { opGetSellerFeedback as getSellerFeedback } from './ops/get-seller-feedback.js';
export { opGetColors as getColors } from './ops/get-colors.js';
export { opGetSizeGroups as getSizeGroups } from './ops/get-size-groups.js';