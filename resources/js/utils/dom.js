/**
 * DOM Utilities
 * Common DOM manipulation helpers
 */

export const qs = (selector, ctx = document) => ctx.querySelector(selector);
export const qsa = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));
export const noop = () => {};
export const isString = (v) => typeof v === 'string' && v.length > 0;

