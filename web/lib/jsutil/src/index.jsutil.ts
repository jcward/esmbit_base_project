export { JSUtil } from './JSUtil';
export { UUID } from './UUID';

// This is the basis of the mixin / default implementation logic
export type MixinConstructor<T = {}> = new (...args: any[]) => T;

// A fake function that allows us to inline data / code. Still TBD whether we keep / use it
export function ROLLUP_INLINE(path: string, opts ?: any): any { }

export type DigestAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';
