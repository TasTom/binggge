export function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(`binggge:${key}`)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export function writeStorage(key, value) {
  try {
    localStorage.setItem(`binggge:${key}`, JSON.stringify(value))
  } catch {
    // Le stockage peut être désactivé ; la session reste utilisable en mémoire.
  }
}
