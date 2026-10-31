export interface DiffLine {
  type: 'same' | 'add' | 'remove'
  text: string
}

/** A small line diff (longest common subsequence). Used only to show a readable patch plan. */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i++; j++ }
    else if (table[i + 1][j] >= table[i][j + 1]) out.push({ type: 'remove', text: a[i++] })
    else out.push({ type: 'add', text: b[j++] })
  }
  while (i < a.length) out.push({ type: 'remove', text: a[i++] })
  while (j < b.length) out.push({ type: 'add', text: b[j++] })
  return out
}

/** Keeps only the changed lines plus a little context, so a patch plan stays short. */
export function changedHunks(lines: DiffLine[], context = 1): DiffLine[] {
  const keep = lines.map((line, index) => line.type !== 'same' || lines.slice(Math.max(0, index - context), index + context + 1).some((l) => l.type !== 'same'))
  const out: DiffLine[] = []
  keep.forEach((flag, index) => {
    if (flag) out.push(lines[index])
    else if (out.length && out[out.length - 1].text !== '…') out.push({ type: 'same', text: '…' })
  })
  while (out.length && out[out.length - 1].text === '…') out.pop()
  return out
}
