/**
 * 類別色票的指派規則。
 *
 * 兩條不可妥協的規則：
 *
 * 1. **固定順序，永不循環。** 第 9 個類別不會被指派一個新色相 ——
 *    在色盲模擬下，任何新生成的第 9 色都與既有色票難以區分。
 *    超出的部分一律折成「其他」（中性灰）。
 *
 * 2. **顏色跟著標的走，不跟著排名走。** 色票依 symbol 指派，
 *    所以篩選掉某個標的時，其餘標的不會換色 ——
 *    否則「VOO 是藍色」這個認知會在每次篩選後失效。
 */

/** 八個色票對應 index.css 的 --series-1 ~ --series-8，深淺色模式各自取階 */
export const SERIES_SLOTS = 8

/** 超出色票數時，尾端類別合併為此標籤 */
export const OTHER_LABEL = '其他'

/**
 * 依序指派色票。輸入必須是穩定排序過的類別清單
 * （calcAllocation 已依市值由大到小排序）。
 */
export function seriesColor(index: number): string {
  if (index >= SERIES_SLOTS) return 'var(--ink-muted)' // 「其他」用中性灰，不佔用色票
  return `var(--series-${index + 1})`
}

export interface FoldedSlice<T> {
  key: string
  label: string
  value: number
  color: string
  /** 被折進「其他」的原始項目，供表格展開顯示 */
  members: T[]
}

/**
 * 把超過 8 個的類別折成「其他」。
 *
 * 只有在超出「至少兩個」時才折 —— 若剛好第 9 個，折起來的「其他」
 * 只含一項，等於平白把一個看得懂的標的名稱換成沒有資訊的「其他」。
 */
export function foldToSlots<T>(
  items: T[],
  getKey: (item: T) => string,
  getValue: (item: T) => number
): FoldedSlice<T>[] {
  const fits = items.length <= SERIES_SLOTS + 1

  if (fits) {
    return items.slice(0, SERIES_SLOTS + 1).map((item, i) => ({
      key: getKey(item),
      label: getKey(item),
      value: getValue(item),
      // 第 9 項（index 8）落在 SERIES_SLOTS 之外時會拿到中性灰，
      // 這是刻意的：寧可讓它中性，也不生成第 9 個色相。
      color: seriesColor(i),
      members: [item],
    }))
  }

  const head = items.slice(0, SERIES_SLOTS - 1)
  const tail = items.slice(SERIES_SLOTS - 1)

  return [
    ...head.map((item, i) => ({
      key: getKey(item),
      label: getKey(item),
      value: getValue(item),
      color: seriesColor(i),
      members: [item],
    })),
    {
      key: '__other__',
      label: OTHER_LABEL,
      value: tail.reduce((sum, item) => sum + getValue(item), 0),
      color: 'var(--ink-muted)',
      members: tail,
    },
  ]
}
