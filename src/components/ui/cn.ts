/** Une clases condicionales (filtra falsy). Helper mínimo del design system. */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
