import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import App from './App.jsx'

const respond = (data, status = 200) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => data })
const show = { id: 900, title: 'Une série test', year: 2024, image: null }
const renderApp = (fetch = vi.fn()) => { vi.stubGlobal('fetch', fetch); return render(<App />) }

describe('Le parcours de recherche', () => {
  test('présente six séries réelles et ouvre la recherche sans requête préalable', () => {
    const fetch = vi.fn()
    renderApp(fetch)
    expect(screen.getByRole('heading', { name: 'Ça vaut le détour' })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(6)
    expect(screen.getByRole('searchbox', { name: 'Rechercher une série' })).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  test('encode la recherche, affiche les résultats et les affiches manquantes', async () => {
    const fetch = vi.fn().mockImplementation(() => respond([show]))
    const user = userEvent.setup()
    renderApp(fetch)
    await user.type(screen.getByRole('searchbox'), 'L’été & nous')
    await user.click(screen.getByRole('button', { name: 'Rechercher' }))
    expect(fetch.mock.calls[0][0]).toBe('/api/shows?q=L%E2%80%99%C3%A9t%C3%A9%20%26%20nous')
    expect(await screen.findByRole('heading', { name: show.title })).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(screen.getByRole('article')).toHaveTextContent('2024')
  })

  test('ignore une ancienne réponse qui arrive après une nouvelle recherche', async () => {
    let resolveOld
    const fetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
      .mockImplementationOnce(() => respond([show]))
    const user = userEvent.setup()
    renderApp(fetch)
    await user.click(screen.getByRole('button', { name: 'Severance' }))
    await user.click(screen.getByRole('button', { name: 'Dark' }))
    await screen.findByRole('heading', { name: show.title })
    await act(async () => { resolveOld(await respond([{ ...show, id: 901, title: 'Ancienne réponse' }])) })
    expect(screen.queryByRole('heading', { name: 'Ancienne réponse' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Résultats pour « Dark »' })).toBeInTheDocument()
  })

  test('propose de réessayer après une erreur, puis traite un résultat vide', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError('offline')).mockImplementationOnce(() => respond([]))
    const user = userEvent.setup()
    renderApp(fetch)
    await user.click(screen.getByRole('button', { name: 'Dark' }))
    expect(await screen.findByText('Le serveur est injoignable. Réessayez dans un instant.')).toBeInTheDocument()
    expect(screen.getByText(/Utilisez le bouton Réessayer pour relancer la recherche/)).toHaveAttribute('role', 'status')
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByRole('heading', { name: 'Pas encore le bon titre.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Voir la sélection' }))
    expect(screen.getAllByRole('article')).toHaveLength(6)
  })
})

describe('Le profil et la watchlist', () => {
  test('crée un profil avant d’ajouter une série et empêche un second ajout', async () => {
    const fetch = vi.fn()
      .mockImplementationOnce(() => respond({ login: 'camille' }, 201))
      .mockImplementationOnce(() => respond([]))
      .mockImplementationOnce(() => respond({ id: 1, showId: 44933, title: 'Severance', seen: false }, 201))
    const user = userEvent.setup()
    renderApp(fetch)
    await user.click(screen.getByRole('button', { name: 'Ajouter Severance à ma watchlist' }))
    expect(screen.getByText('Choisissez votre profil pour ajouter « Severance ».')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Créer un profil' }))
    await user.type(screen.getByRole('textbox', { name: 'Votre pseudo' }), ' camille ')
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    const addedButton = await screen.findByRole('button', { name: 'Severance est dans votre watchlist' })
    expect(addedButton).toBeDisabled()
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['/api/register', '/api/watchlist', '/api/watchlist'])
    expect(fetch.mock.calls[2][1].headers['X-User']).toBe('camille')
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toEqual({ show_id: 44933, title: 'Severance' })
    expect(JSON.parse(localStorage.getItem('binggge:profile'))).toBe('camille')
    await user.click(addedButton)
    expect(fetch).toHaveBeenCalledTimes(3)
    await user.click(screen.getByRole('link', { name: 'Ma watchlist 1' }))
    expect(await screen.findByRole('heading', { name: 'Severance' })).toBeInTheDocument()
    expect(screen.getByText('À regarder')).toBeInTheDocument()
  })

  test('présente un pseudo déjà pris et permet de retrouver le profil existant', async () => {
    const fetch = vi.fn().mockImplementationOnce(() => respond({}, 409)).mockImplementationOnce(() => respond([]))
    const user = userEvent.setup()
    renderApp(fetch)
    await user.click(screen.getByRole('button', { name: 'Mon profil' }))
    await user.click(screen.getByRole('button', { name: 'Créer un profil' }))
    await user.type(screen.getByRole('textbox', { name: 'Votre pseudo' }), 'camille')
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ce pseudo est déjà utilisé')
    expect(localStorage.getItem('binggge:profile')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Retrouver mon profil' }))
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    expect(await screen.findByRole('button', { name: 'camille' })).toHaveFocus()
  })

  test('restaure un profil, filtre la liste et quitte le profil sans effacer la liste sur le serveur', async () => {
    localStorage.setItem('binggge:profile', JSON.stringify('camille'))
    window.location.hash = '#watchlist'
    const fetch = vi.fn().mockImplementation(() => respond([
      { id: 1, showId: 44933, title: 'Severance', seen: false },
      { id: 2, showId: 169, title: 'Breaking Bad', seen: true },
    ]))
    const user = userEvent.setup()
    renderApp(fetch)
    expect(await screen.findByRole('heading', { name: 'Severance' })).toBeInTheDocument()
    await user.type(screen.getByRole('searchbox', { name: 'Filtrer ma watchlist' }), 'BREAKING')
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(within(screen.getByRole('article')).getByText('Déjà vue')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'camille' }))
    await user.click(screen.getByRole('button', { name: 'Quitter le profil camille' }))
    expect(await screen.findByRole('heading', { name: 'Les bonnes séries se gardent.' })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(JSON.parse(localStorage.getItem('binggge:profile'))).toBe('')
  })

  test('ne prétend pas avoir chargé une liste lorsque le serveur échoue', async () => {
    localStorage.setItem('binggge:profile', JSON.stringify('camille'))
    const fetch = vi.fn().mockImplementationOnce(() => respond({}, 500)).mockImplementationOnce(() => respond([]))
    const user = userEvent.setup()
    renderApp(fetch)
    expect(await screen.findByRole('alert')).toHaveTextContent('Votre watchlist n’a pas pu être chargée')
    expect(screen.getByRole('button', { name: 'Ajouter Severance à ma watchlist' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Réessayer' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ajouter Severance à ma watchlist' })).toBeEnabled())
  })

  test('changer de profil pendant un ajout ne bloque pas la nouvelle watchlist', async () => {
    localStorage.setItem('binggge:profile', JSON.stringify('camille'))
    let resolveOldAdd
    const fetch = vi.fn()
      .mockImplementationOnce(() => respond([]))
      .mockImplementationOnce(() => new Promise(resolve => { resolveOldAdd = resolve }))
      .mockImplementationOnce(() => respond([]))
    const user = userEvent.setup()
    renderApp(fetch)
    const add = await screen.findByRole('button', { name: 'Ajouter Severance à ma watchlist' })
    await waitFor(() => expect(add).toBeEnabled())
    await user.click(add)
    await user.click(screen.getByRole('button', { name: 'camille' }))
    const login = screen.getByRole('textbox', { name: 'Votre pseudo' })
    await user.clear(login)
    await user.type(login, 'marie')
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    await screen.findByRole('button', { name: 'marie' })
    expect(screen.getByRole('button', { name: 'Ajouter Dark à ma watchlist' })).toBeEnabled()
    await act(async () => { resolveOldAdd(await respond({ id: 3, showId: 44933, title: 'Severance', seen: false }, 201)) })
    expect(screen.getByRole('button', { name: 'Ajouter Severance à ma watchlist' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Severance est dans votre watchlist' })).not.toBeInTheDocument()
  })

  test('une connexion annulée ne restaure pas un profil après l’avoir quitté', async () => {
    localStorage.setItem('binggge:profile', JSON.stringify('camille'))
    let resolveOldConnection
    const fetch = vi.fn()
      .mockImplementationOnce(() => respond([]))
      .mockImplementationOnce(() => new Promise(resolve => { resolveOldConnection = resolve }))
    const user = userEvent.setup()
    renderApp(fetch)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ajouter Severance à ma watchlist' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'camille' }))
    const login = screen.getByRole('textbox', { name: 'Votre pseudo' })
    await user.clear(login)
    await user.type(login, 'bob')
    await user.click(screen.getByRole('button', { name: 'Continuer' }))
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2))
    await user.click(screen.getByRole('button', { name: 'camille' }))
    await user.click(screen.getByRole('button', { name: 'camille' }))
    await user.click(screen.getByRole('button', { name: 'Quitter le profil camille' }))
    await act(async () => { resolveOldConnection(await respond([])) })
    expect(screen.getByRole('button', { name: 'Mon profil' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'bob' })).not.toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('binggge:profile'))).toBe('')
  })

  test('le lien d’évitement conserve la watchlist et donne le focus au contenu', async () => {
    window.location.hash = '#watchlist'
    const user = userEvent.setup()
    renderApp()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('main')).toHaveFocus()
    expect(window.location.hash).toBe('#watchlist')
    expect(screen.getByRole('heading', { name: 'Ma watchlist' })).toBeInTheDocument()
  })
})
