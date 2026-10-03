export function mergeDefined<T extends object>(target: T, patch: Partial<T>): void {
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (patch[key] !== undefined) target[key] = patch[key]!
  }
}
