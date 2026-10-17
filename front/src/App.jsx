import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, Bookmark, Check, Clapperboard, Film, LoaderCircle, LogOut, Plus, Search, UserRound, X } from 'lucide-react'
import { api } from './api.js'
import selection from './data/selection.json'
import { readStorage, writeStorage } from './storage.js'

const initialCache = Object.fromEntries(selection.map(show => [show.id, show]))
const suggestedSearches = ['Severance', 'The Bear', 'Dark', 'Friends']
const currentView = () => window.location.hash === '#watchlist' ? 'watchlist' : 'explorer'

function ShowCard({ show, saved, pending, disabled, onAdd, inWatchlist }) {
  const [failedImage, setFailedImage] = useState(null)
  const image = show.image?.startsWith('posters/')
    ? `${import.meta.env.BASE_URL}${show.image}`
    : show.image

  return (
    <article className="show-card">
      <div className="poster">
        {image && failedImage !== image ? (
          <img src={image} alt={`Affiche de ${show.title}`} width="210" height="295" loading="lazy" onError={() => setFailedImage(image)} />
        ) : (
          <div className="poster-fallback"><Film size={32} strokeWidth={1.25} /><span>{show.title}</span></div>
        )}
        {inWatchlist ? (
          <span className="poster-status"><Bookmark size={14} />{show.seen ? 'Déjà vue' : 'À regarder'}</span>
        ) : (
          <button
            type="button"
            className={`add-button ${saved ? 'is-saved' : ''}`}
            aria-label={saved ? `${show.title} est dans votre watchlist` : `Ajouter ${show.title} à ma watchlist`}
            disabled={saved || disabled}
            onClick={() => onAdd(show)}
          >
            {pending ? <LoaderCircle size={18} className="spin" /> : saved ? <Check size={18} /> : <Plus size={18} />}
            <span>{pending ? 'Ajout…' : saved ? 'Dans ma liste' : 'Ma watchlist'}</span>
          </button>
        )}
      </div>
      <h3>{show.title}</h3>
      <p className="show-meta">{show.year || 'Année inconnue'}<span aria-hidden="true">·</span>{show.genre || 'Série'}</p>
    </article>
  )
}

function ProfilePanel({ login, pendingTitle, onConnect, onClose, onLogout }) {
  const [mode, setMode] = useState('existing')
  const [value, setValue] = useState(login || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const input = useRef(null)

  useEffect(() => { input.current?.focus() }, [])

  async function submit(event) {
    event.preventDefault()
    if (!value.trim()) {
      setError('Saisissez votre pseudo pour continuer.')
      input.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    try {
      await onConnect(value.trim(), mode === 'new')
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="profile-panel" id="profile-panel" aria-labelledby="profile-heading">
      <div className="profile-intro">
        <h2 id="profile-heading">Un pseudo. Votre sélection.</h2>
        <p>{pendingTitle ? `Choisissez votre profil pour ajouter « ${pendingTitle} ».` : 'Retrouvez vos envies de séries, d’une visite à l’autre.'}</p>
        <p className="profile-note">Votre pseudo suffit pour accéder à votre liste. Aucun mot de passe.</p>
        {login && <button className="text-button logout" onClick={onLogout} disabled={busy}><LogOut size={16} />Quitter le profil {login}</button>}
      </div>
      <form className="profile-form" onSubmit={submit}>
        <div className="profile-modes" aria-label="Choix du profil">
          <button type="button" aria-pressed={mode === 'existing'} onClick={() => { setMode('existing'); setError('') }} disabled={busy}>Retrouver mon profil</button>
          <button type="button" aria-pressed={mode === 'new'} onClick={() => { setMode('new'); setError('') }} disabled={busy}>Créer un profil</button>
        </div>
        <label htmlFor="profile-login">Votre pseudo</label>
        <div className="profile-input-row">
          <input ref={input} id="profile-login" name="username" autoComplete="username" value={value} onChange={event => setValue(event.target.value)} maxLength={80} disabled={busy} aria-invalid={Boolean(error)} aria-describedby={error ? 'profile-error' : undefined} placeholder="Ex. tom" />
          <button className="button button-primary" disabled={busy}>{busy ? <LoaderCircle size={18} className="spin" /> : <ArrowRight size={18} />}<span>{busy ? 'Patientez…' : 'Continuer'}</span></button>
        </div>
        {error && <p id="profile-error" className="form-error" role="alert">{error}</p>}
      </form>
      <button className="icon-button close-profile" aria-label="Fermer le choix de profil" onClick={onClose} disabled={busy}><X size={20} /></button>
    </section>
  )
}

export default function App() {
  const [view, setView] = useState(currentView)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState({ query: '', items: [], status: 'idle', error: '' })
  const [session, setSession] = useState(() => {
    const stored = readStorage('profile', '')
    return { login: typeof stored === 'string' ? stored : '', items: [], status: stored ? 'loading' : 'idle', error: '' }
  })
  const [cache, setCache] = useState(() => {
    const stored = readStorage('shows', {})
    return { ...initialCache, ...(stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {}) }
  })
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileFormKey, setProfileFormKey] = useState(0)
  const [pendingShow, setPendingShow] = useState(null)
  const [adding, setAdding] = useState(null)
  const [notice, setNotice] = useState({ text: '', error: false })
  const [watchlistFilter, setWatchlistFilter] = useState('')
  const profileButton = useRef(null)
  const searchInput = useRef(null)
  const searchRequest = useRef(null)
  const sessionVersion = useRef(0)
  const connectionVersion = useRef(0)

  useEffect(() => {
    const onHashChange = () => setView(currentView())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    const login = readStorage('profile', '')
    if (typeof login !== 'string' || !login) return
    const controller = new AbortController()
    const version = ++sessionVersion.current
    api.watchlist(login, controller.signal).then(items => {
      if (sessionVersion.current === version) setSession({ login, items, status: 'ready', error: '' })
    }).catch(error => {
      if (!controller.signal.aborted && sessionVersion.current === version) {
        setSession({ login, items: [], status: 'error', error: error.message })
      }
    })
    return () => controller.abort()
  }, [])

  useEffect(() => () => searchRequest.current?.abort(), [])

  function remember(shows) {
    setCache(previous => {
      // Une petite réserve d’affiches suffit, sans remplir le stockage du navigateur.
      const entries = Object.entries(previous).slice(-150)
      const next = { ...Object.fromEntries(entries), ...Object.fromEntries(shows.map(show => [show.id, show])) }
      writeStorage('shows', next)
      return next
    })
  }

  async function runSearch(value) {
    const term = value.trim()
    if (!term) {
      searchInput.current?.focus()
      return
    }
    searchRequest.current?.abort()
    const controller = new AbortController()
    searchRequest.current = controller
    setQuery(term)
    setSearch({ query: term, items: [], status: 'loading', error: '' })
    try {
      const items = await api.search(term, controller.signal)
      if (!controller.signal.aborted) {
        remember(items)
        setSearch({ query: term, items, status: 'ready', error: '' })
      }
    } catch (error) {
      if (!controller.signal.aborted) setSearch({ query: term, items: [], status: 'error', error: error.message })
    }
  }

  function resetSearch() {
    searchRequest.current?.abort()
    setQuery('')
    setSearch({ query: '', items: [], status: 'idle', error: '' })
    searchInput.current?.focus()
  }

  function closeProfile() {
    connectionVersion.current += 1
    setProfileOpen(false)
    setPendingShow(null)
    profileButton.current?.focus()
  }

  function openProfile(show = null) {
    connectionVersion.current += 1
    setProfileFormKey(previous => previous + 1)
    setPendingShow(show)
    setProfileOpen(true)
  }

  async function connect(login, create) {
    const attempt = ++connectionVersion.current
    const isCurrent = () => connectionVersion.current === attempt
    const showToAdd = pendingShow
    try {
      if (create) {
        await api.register(login)
        if (!isCurrent()) return
      }
      const items = await api.watchlist(login)
      if (!isCurrent()) return
      let nextItems = items
      if (showToAdd && !items.some(item => item.showId === showToAdd.id)) {
        const added = await api.add(login, showToAdd)
        if (!isCurrent()) return
        nextItems = [...items, added]
        remember([showToAdd])
        setNotice({ text: `« ${showToAdd.title} » a été ajoutée à votre watchlist.`, error: false })
      } else {
        setNotice({ text: `Le profil ${login} est prêt. Votre watchlist contient ${items.length} série${items.length > 1 ? 's' : ''}.`, error: false })
      }
      sessionVersion.current += 1
      setAdding(null)
      setSession({ login, items: nextItems, status: 'ready', error: '' })
      writeStorage('profile', login)
      closeProfile()
    } catch (error) {
      if (isCurrent()) throw error
    }
  }

  function logout() {
    sessionVersion.current += 1
    setSession({ login: '', items: [], status: 'idle', error: '' })
    setAdding(null)
    writeStorage('profile', '')
    setNotice({ text: 'Vous avez quitté votre profil.', error: false })
    closeProfile()
  }

  async function reloadWatchlist() {
    const version = sessionVersion.current
    setSession(previous => ({ ...previous, status: 'loading', error: '' }))
    try {
      const items = await api.watchlist(session.login)
      if (version === sessionVersion.current) setSession(previous => ({ ...previous, items, status: 'ready' }))
    } catch (error) {
      if (version === sessionVersion.current) setSession(previous => ({ ...previous, status: 'error', error: error.message }))
    }
  }

  async function addShow(show) {
    if (!session.login) {
      openProfile(show)
      return
    }
    if (adding !== null || session.status !== 'ready' || session.items.some(item => item.showId === show.id)) return
    const version = sessionVersion.current
    setAdding(show.id)
    setNotice({ text: '', error: false })
    try {
      const item = await api.add(session.login, show)
      if (version !== sessionVersion.current) return
      remember([show])
      setSession(previous => ({ ...previous, items: [...previous.items, item] }))
      setNotice({ text: `« ${show.title} » a été ajoutée à votre watchlist.`, error: false })
    } catch (error) {
      if (version === sessionVersion.current) setNotice({ text: error.message, error: true })
    } finally {
      if (version === sessionVersion.current) setAdding(null)
    }
  }

  const exploring = view === 'explorer'
  const shows = search.status === 'idle' ? selection : search.items
  const watchlist = session.items
    .filter(item => item.title.toLocaleLowerCase('fr').includes(watchlistFilter.toLocaleLowerCase('fr')))
    .map(item => ({ ...(cache[item.showId] || initialCache[item.showId]), ...item, id: item.showId }))

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main" onClick={event => { event.preventDefault(); document.getElementById('main')?.focus() }}>Aller au contenu</a>
      <header className="site-header">
        <div className="container header-inner">
          <a className="wordmark" href="#explorer" aria-label="binggge, accueil"><Clapperboard size={25} strokeWidth={1.8} /><span>binggge<span className="brand-dot">.</span></span></a>
          <nav className="main-nav" aria-label="Navigation principale">
            <a href="#explorer" aria-current={exploring ? 'page' : undefined}><Search size={17} /><span>Explorer</span></a>
            <a href="#watchlist" aria-current={!exploring ? 'page' : undefined}><Bookmark size={17} /><span>Ma watchlist</span>{session.login && session.status === 'ready' && <span className="nav-count">{session.items.length}</span>}</a>
          </nav>
          <button ref={profileButton} className={`profile-button ${session.login ? 'has-profile' : ''}`} aria-expanded={profileOpen} aria-controls="profile-panel" onClick={() => profileOpen ? closeProfile() : openProfile()}>
            {session.login ? <span className="avatar" aria-hidden="true">{session.login.slice(0, 1).toLocaleUpperCase('fr')}</span> : <UserRound size={18} />}<span>{session.login || 'Mon profil'}</span>
          </button>
        </div>
      </header>

      <main id="main" className="container" tabIndex={-1}>
        {profileOpen && <ProfilePanel key={profileFormKey} login={session.login} pendingTitle={pendingShow?.title} onConnect={connect} onClose={closeProfile} onLogout={logout} />}

        {session.login && session.status === 'error' && exploring && (
          <div className="inline-alert" role="alert"><p>Votre watchlist n’a pas pu être chargée. {session.error}</p><button className="text-button" onClick={reloadWatchlist}>Réessayer</button><button className="text-button" onClick={() => openProfile()}>Choisir un profil</button></div>
        )}

        <div className={`page-intro ${exploring ? '' : 'watchlist-intro'}`}>
          <div>
            <h1>{exploring ? <>Votre prochaine série.<br /><span>Au bon endroit.</span></> : <>Vos séries.<br /><span>À votre rythme.</span></>}</h1>
            <p>{exploring ? 'Les séries qui vous intriguent, les histoires qui restent.\nTrouvez la prochaine et gardez-la pour plus tard.' : 'Toutes les histoires que vous avez envie de découvrir, réunies ici.'}</p>
          </div>
          <div className="intro-aside" aria-hidden="true"><Bookmark size={28} strokeWidth={1.15} /><p>{exploring ? <>Une envie de série,<br />une place dans votre liste.</> : <>Ce soir, la bonne série<br />est peut-être déjà ici.</>}</p><ArrowDown size={17} /></div>
        </div>

        {exploring ? (
          <>
            <form className="search-form" onSubmit={event => { event.preventDefault(); runSearch(query) }} role="search">
              <label className="sr-only" htmlFor="series-search">Rechercher une série</label>
              <Search className="search-icon" size={22} strokeWidth={1.7} />
              <input ref={searchInput} id="series-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Une série en tête ?" autoComplete="off" maxLength={200} />
              {query && <button className="icon-button clear-search" type="button" aria-label="Effacer la recherche" onClick={resetSearch}><X size={18} /></button>}
              <button className="button button-primary search-submit" disabled={!query.trim()}><span>Rechercher</span><ArrowRight size={18} /></button>
            </form>
            <div className="suggestions"><span>Une idée pour commencer :</span><div>{suggestedSearches.map(term => <button key={term} onClick={() => runSearch(term)}>{term}<ArrowRight size={12} /></button>)}</div></div>

            <section className="results-section" aria-labelledby="results-heading" aria-busy={search.status === 'loading'}>
              <div className="section-heading"><div><h2 id="results-heading">{search.status === 'idle' ? 'Ça vaut le détour' : `Résultats pour « ${search.query} »`}</h2><p>{search.status === 'idle' ? 'Six séries, six univers. À vous de choisir.' : search.status === 'ready' ? `${shows.length} série${shows.length > 1 ? 's' : ''} trouvée${shows.length > 1 ? 's' : ''}` : search.status === 'loading' ? 'On cherche votre prochaine série…' : 'La recherche n’a pas abouti.'}</p></div>{search.status !== 'idle' && <button className="text-button back-selection" onClick={resetSearch}>Voir la sélection<X size={15} /></button>}</div>
              <div className="sr-only" role="status">{search.status === 'loading' ? 'Recherche en cours.' : search.status === 'ready' ? `${shows.length} résultats pour ${search.query}.` : search.status === 'error' ? `${search.error} Utilisez le bouton Réessayer pour relancer la recherche.` : ''}</div>
              {search.status === 'loading' ? <LoadingGrid /> : search.status === 'error' ? (
                <EmptyState icon={Search} title="La recherche fait une pause." text={search.error} action="Réessayer" onAction={() => runSearch(search.query)} />
              ) : shows.length === 0 ? (
                <EmptyState icon={Search} title="Pas encore le bon titre." text="Aucune série ne correspond à cette recherche. Essayez un autre titre ou vérifiez l’orthographe." action="Modifier ma recherche" onAction={() => searchInput.current?.focus()} />
              ) : (
                <div className="shows-grid">{shows.map(show => <ShowCard key={show.id} show={show} saved={session.items.some(item => item.showId === show.id)} pending={adding === show.id} disabled={adding !== null || Boolean(session.login && session.status !== 'ready')} onAdd={addShow} />)}</div>
              )}
            </section>
          </>
        ) : (
          <section className="watchlist-section" aria-labelledby="watchlist-heading" aria-busy={session.status === 'loading'}>
            <div className="section-heading"><div><h2 id="watchlist-heading">Ma watchlist{session.login && <span className="heading-count">{session.items.length}</span>}</h2><p>Votre petit programme des prochaines soirées.</p></div>{session.items.length > 0 && <div className="filter-field"><Search size={17} /><label className="sr-only" htmlFor="watchlist-filter">Filtrer ma watchlist</label><input id="watchlist-filter" type="search" placeholder="Filtrer ma liste" value={watchlistFilter} onChange={event => setWatchlistFilter(event.target.value)} /></div>}</div>
            {!session.login ? <EmptyState icon={Bookmark} title="Les bonnes séries se gardent." text="Choisissez votre profil pour retrouver votre watchlist, ou créez-en un en quelques secondes." action="Choisir mon profil" onAction={() => openProfile()} /> : session.status === 'loading' ? <LoadingGrid /> : session.status === 'error' ? <EmptyState icon={Bookmark} title="Votre liste se fait attendre." text={session.error} action="Réessayer" onAction={reloadWatchlist} /> : session.items.length === 0 ? <EmptyState icon={Bookmark} title="Votre prochaine découverte a sa place ici." text="Ajoutez les séries qui vous tentent depuis l’onglet Explorer. Vous les retrouverez dans cette liste." action="Explorer les séries" href="#explorer" /> : watchlist.length === 0 ? <EmptyState icon={Search} title="Aucun titre dans ce filtre." text="Essayez un autre mot ou affichez à nouveau toute votre liste." action="Effacer le filtre" onAction={() => setWatchlistFilter('')} /> : <div className="shows-grid">{watchlist.map(show => <ShowCard key={show.id} show={show} inWatchlist />)}</div>}
          </section>
        )}

        {exploring && <aside className="watchlist-invitation"><div className="invitation-mark"><Bookmark size={24} strokeWidth={1.4} /></div><div><h2>La bonne série, au bon moment.</h2><p>Gardez vos découvertes dans votre watchlist. Le plus dur sera de choisir.</p></div><a className="text-button" href="#watchlist">Voir ma watchlist<ArrowRight size={17} /></a></aside>}
      </main>

      <footer className="site-footer container"><a className="footer-brand" href="#explorer">binggge.</a><p>Moins chercher. Mieux regarder.</p><p>Données et affiches : <a href="https://www.tvmaze.com" target="_blank" rel="noreferrer">TVMaze<ArrowRight size={12} /></a></p></footer>
      <div className={`toast ${notice.text ? 'is-visible' : ''} ${notice.error ? 'toast-error' : ''}`} role="status" aria-atomic="true">{notice.text && <>{notice.error ? <Film size={18} /> : <Check size={18} />}<span>{notice.text}</span><button className="icon-button" aria-label="Fermer la notification" onClick={() => setNotice({ text: '', error: false })}><X size={17} /></button></>}</div>
    </div>
  )
}

function EmptyState({ icon: Icon, title, text, action, onAction, href }) {
  return <div className="empty-state"><Icon size={30} strokeWidth={1.3} /><h3>{title}</h3><p>{text}</p>{href ? <a className="button button-primary" href={href}>{action}<ArrowRight size={17} /></a> : <button className="button button-primary" onClick={onAction}>{action}<ArrowRight size={17} /></button>}</div>
}

function LoadingGrid() {
  return <div className="shows-grid skeleton-grid" role="status" aria-label="Chargement des séries"><span className="sr-only">Chargement des séries…</span>{Array.from({ length: 6 }, (_, index) => <div key={index} aria-hidden="true" className="skeleton-card"><div /><span /><span /></div>)}</div>
}
