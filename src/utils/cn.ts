import clsx, { type ClassValue } from 'clsx'

/** 合併 class name，供元件的 variant 與呼叫端覆寫用 */
export function cn(...classes: ClassValue[]): string {
  return clsx(classes)
}
