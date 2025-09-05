export function getApiErrorMessage(err: any): string {
  if (!err) return 'Unknown error'
  const msg = (err?.response?.data?.detail || err?.message || '').toString()
  return msg || 'Unknown error'
}

