import { en, type CopyKey } from './en';

export { en, type CopyKey };

const table: Record<string, string> = en;

/** Looks up a copy key (engine keys are plain strings) and fills `{placeholders}`. */
export function t(key: CopyKey | string, vars: Record<string, string | number> = {}): string {
  const template = table[key];
  if (template === undefined) throw new Error(`Missing copy key: ${key}`);
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    vars[name] === undefined ? match : String(vars[name]),
  );
}
