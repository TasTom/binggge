const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request(path, { login, signal, ...options } = {}) {
  let response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(login ? { 'X-User': login } : {}),
      },
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError('Le serveur est injoignable. Réessayez dans un instant.')
  }

  if (!response.ok) {
    const messages = {
      401: 'Ce profil est introuvable. Vérifiez votre pseudo ou créez un profil.',
      409: 'Ce pseudo est déjà utilisé. Retrouvez votre profil ou choisissez un autre pseudo.',
      400: 'Vérifiez les informations saisies, puis réessayez.',
    }
    throw new ApiError(messages[response.status] || 'Le serveur rencontre un problème. Réessayez dans un instant.', response.status)
  }

  try {
    return await response.json()
  } catch {
    throw new ApiError('La réponse du serveur est illisible. Réessayez dans un instant.')
  }
}

export const api = {
  search: (query, signal) => request(`/shows?q=${encodeURIComponent(query)}`, { signal }),
  watchlist: (login, signal) => request('/watchlist', { login, signal }),
  register: login => request('/register', { method: 'POST', body: JSON.stringify({ login }) }),
  add: (login, show) => request('/watchlist', {
    login,
    method: 'POST',
    body: JSON.stringify({ show_id: show.id, title: show.title }),
  }),
}
