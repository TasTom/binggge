import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'

beforeEach(() => {
  localStorage.clear()
  window.location.hash = '#explorer'
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
