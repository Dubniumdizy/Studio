export function downloadCSV(headers: string[], rows: (string | number | null | undefined)[][], filename: string) {
  if (typeof window === 'undefined') return
  const escapeCell = (cell: any) => {
    if (cell === null || cell === undefined) return ''
    const str = String(cell)
    if (/[",\n]/.test(str)) {
      return '"' + str.replace(/"/g, '""') + '"'
    }
    return str
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','))
  }
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

