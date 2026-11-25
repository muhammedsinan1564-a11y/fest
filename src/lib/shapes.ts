/**
 * `src/lib/shapes.ts` — entry point for the Festize shape library.
 *
 * The implementation lives in `./shapes.tsx` because the shape renderers are
 * JSX components; every import of `./shapes` resolves to this file first and
 * is forwarded to the `.tsx` module, so both paths expose the same API.
 */
export * from "./shapes.tsx";
