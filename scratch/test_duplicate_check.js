import { isDuplicateListing } from '../src/services/dataService.ts';

const summary = `G03865
*DUPLICATE ROW 2423 - G02447*
Unit 6D Two Roxas Triangle, Brgy. Urdaneta, Makati City`;

console.log('Is duplicate:', isDuplicateListing(summary));
