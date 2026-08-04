/**
 * A stylesheet imported for its side effect has no exports, but it still has to
 * BE a module. Next ships a declaration for `*.module.css` only, so plain global
 * stylesheets — `./globals.css`, `@hanzo/ui/theme.css` — need this one.
 *
 * tsc lets an unresolved side-effect import pass silently; tsgo (TypeScript 7)
 * reports it as TS2882, which is the stricter and more honest read. Global, not
 * a module: a wildcard `declare module` in a file with imports would be parsed
 * as an augmentation of a module that does not exist.
 */
declare module '*.css'
