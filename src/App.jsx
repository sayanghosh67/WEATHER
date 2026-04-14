import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'framer-motion'

const WeatherScene = lazy(() => import('./components/WeatherScene'))

const API_KEY     = import.meta.env.VITE_OPENWEATHER_API_KEY
const WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'
const FORECAST_URL= 'https://api.openweathermap.org/data/2.5/forecast'
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

/* ─── Weather Themes ─────────────────────────────────────── */
const weatherThemes = {
  clear:        { accent: '#a8d8ff', glow: 'rgba(168,216,255,0.40)', sceneBg: '#030b18' },
  clouds:       { accent: '#7aa8d4', glow: 'rgba(122,168,212,0.38)', sceneBg: '#06101e' },
  rain:         { accent: '#00bfff', glow: 'rgba(0,191,255,0.42)',   sceneBg: '#020a18' },
  drizzle:      { accent: '#38bdf8', glow: 'rgba(56,189,248,0.40)',  sceneBg: '#040d1c' },
  thunderstorm: { accent: '#818cf8', glow: 'rgba(129,140,248,0.45)', sceneBg: '#060414' },
  snow:         { accent: '#cce8ff', glow: 'rgba(200,230,255,0.50)', sceneBg: '#0a1522' },
  default:      { accent: '#00bfff', glow: 'rgba(0,191,255,0.45)',   sceneBg: '#030c1f' },
}

const iconMap = {
  clear: '☀️', clouds: '☁️', rain: '🌧️',
  drizzle: '🌦️', thunderstorm: '⛈️', snow: '❄️', default: '🌤️',
}

const formatDay = (timestamp) =>
  new Date(timestamp * 1000).toLocaleDateString('en-US', { weekday: 'short' })

const codeToCondition = (code) => {
  if (code === 0) return { main: 'Clear', desc: 'clear sky' }
  if ([1, 2, 3].includes(code)) return { main: 'Clouds', desc: 'partly cloudy' }
  if ([45, 48].includes(code)) return { main: 'Clouds', desc: 'foggy' }
  if ([51, 53, 55, 56, 57].includes(code)) return { main: 'Drizzle', desc: 'light drizzle' }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { main: 'Rain', desc: 'rain showers' }
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { main: 'Snow', desc: 'snowfall' }
  if ([95, 96, 99].includes(code)) return { main: 'Thunderstorm', desc: 'thunderstorm' }
  return { main: 'Clouds', desc: 'variable weather' }
}

const shapeFromOpenMeteo = ({ cityLabel, countryCode, data }) => {
  const currentCode      = data.current?.weather_code ?? 0
  const currentCondition = codeToCondition(currentCode)
  const weatherPayload   = {
    name: cityLabel,
    sys:  { country: countryCode ?? '' },
    main: {
      temp:     data.current?.temperature_2m        ?? 0,
      humidity: data.current?.relative_humidity_2m  ?? 0,
    },
    wind:    { speed: data.current?.wind_speed_10m ?? 0 },
    weather: [{ main: currentCondition.main, description: currentCondition.desc }],
  }
  const forecastPayload = (data.daily?.time ?? []).slice(0, 5).map((day, index) => {
    const code      = data.daily?.weather_code?.[index] ?? 0
    const condition = codeToCondition(code)
    return {
      dt:      Math.floor(new Date(day).getTime() / 1000),
      main:    { temp: data.daily?.temperature_2m_max?.[index] ?? 0 },
      weather: [{ main: condition.main, description: condition.desc }],
    }
  })
  return { weatherPayload, forecastPayload }
}

/* ─── Framer Motion Variants ─────────────────────────── */
const containerVariants = {
  hidden:  { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.18, delayChildren: 0.4, ease: [0.32, 0.72, 0, 1] },
  },
}
const itemVariants = {
  hidden:  { opacity: 0, y: 44, filter: 'blur(12px)' },
  visible: { opacity: 1, y: 0,  filter: 'blur(0px)',
    transition: { duration: 1.1, ease: [0.32, 0.72, 0, 1] } },
}

/* ─── Tilt Card ──────────────────────────────────────── */
function TiltCard({ children, className, style }) {
  const ref    = useRef(null)
  const x      = useMotionValue(0)
  const y      = useMotionValue(0)
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5],  [3, -3]), { stiffness: 80, damping: 20 })
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-3,  3]), { stiffness: 80, damping: 20 })

  const handleMouse = useCallback((e) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    x.set((e.clientX - rect.left) / rect.width  - 0.5)
    y.set((e.clientY - rect.top)  / rect.height - 0.5)
  }, [x, y])
  const handleLeave = useCallback(() => { x.set(0); y.set(0) }, [x, y])

  return (
    <motion.div
      ref={ref}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', ...style }}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─── Social Icon SVGs ───────────────────────────────── */
const GithubIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
)

const LinkedinIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
)

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" aria-hidden>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
)

/* ─── App ────────────────────────────────────────────── */
function App() {
  const [introComplete, setIntroComplete] = useState(false)
  const [query,      setQuery]      = useState('Tokyo')
  const [weather,    setWeather]    = useState(null)
  const [forecast,   setForecast]   = useState([])
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [notice,     setNotice]     = useState('')
  const [mouse,      setMouse]      = useState({ x: 0, y: 0 })
  const [cityCoords, setCityCoords] = useState(null)    // { lat, lon }
  const [isSearching,setIsSearching]= useState(false)   // triggers Google-Earth zoom

  const weatherType = weather?.weather?.[0]?.main?.toLowerCase() ?? 'default'
  const theme       = weatherThemes[weatherType] ?? weatherThemes.default
  const weatherIcon = iconMap[weatherType] ?? iconMap.default

  const forecastCards = useMemo(
    () => forecast.map((item) => ({
      day:  formatDay(item.dt),
      temp: Math.round(item.main.temp),
      icon: iconMap[item.weather?.[0]?.main?.toLowerCase()] ?? '🌤️',
      desc: item.weather?.[0]?.description ?? 'Unknown',
    })),
    [forecast],
  )

  const loadWeather = async ({ city, lat, lon }) => {
    setLoading(true)
    setIsSearching(true)
    setError('')
    setNotice('')

    try {
      const apiKey = API_KEY?.trim()
      if (apiKey && apiKey !== 'your_openweather_api_key_here') {
        const currentParams = city
          ? `q=${encodeURIComponent(city)}`
          : `lat=${lat}&lon=${lon}`

        const currentRes = await fetch(
          `${WEATHER_URL}?${currentParams}&appid=${apiKey}&units=metric`,
        )

        if (!currentRes.ok) {
          const currentError = await currentRes.json().catch(() => ({}))
          const status = currentRes.status
          const reason =
            currentError.message ||
            (status === 401
              ? 'Invalid or inactive API key.'
              : status === 404
                ? 'City not found. Please try another search.'
                : 'Unable to load weather data.')
          throw new Error(reason)
        }

        const currentData = await currentRes.json()
        setWeather(currentData)
        /* ── Google-Earth animate to city ── */
        setCityCoords({ lat: currentData.coord.lat, lon: currentData.coord.lon })

        const forecastRes = await fetch(
          `${FORECAST_URL}?lat=${currentData.coord.lat}&lon=${currentData.coord.lon}&appid=${apiKey}&units=metric`,
        )
        if (!forecastRes.ok) {
          const forecastError = await forecastRes.json().catch(() => ({}))
          throw new Error(forecastError.message || 'Unable to load forecast right now.')
        }
        const forecastData = await forecastRes.json()
        const daily = forecastData.list.filter((_, i) => i % 8 === 0).slice(0, 5)
        setForecast(daily)
        setNotice('Live source: OpenWeather')

      } else {
        throw new Error('Missing API key. Add VITE_OPENWEATHER_API_KEY to your .env file.')
      }
    } catch (err) {
      const mainError = err.message || 'Weather service unavailable'

      if (mainError.includes('API key') || mainError.includes('Unauthorized')) {
        setError(mainError)
        return
      }

      try {
        const location = city
          ? await fetch(
              `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
            ).then(async (res) => {
              if (!res.ok) throw new Error('City not found')
              const data = await res.json()
              const first = data.results?.[0]
              if (!first) throw new Error('City not found')
              return first
            })
          : { latitude: lat, longitude: lon, name: 'Current Location', country_code: '' }

        const meteoData = await fetch(
          `${OPEN_METEO_URL}?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max&timezone=auto`,
        ).then(async (res) => {
          if (!res.ok) throw new Error('Backup weather provider unavailable')
          return res.json()
        })

        const { weatherPayload, forecastPayload } = shapeFromOpenMeteo({
          cityLabel:   location.name,
          countryCode: location.country_code,
          data:        meteoData,
        })

        setWeather(weatherPayload)
        setForecast(forecastPayload)
        setCityCoords({ lat: location.latitude, lon: location.longitude })
        setNotice('OpenWeather unavailable. Using backup weather source.')
      } catch (fallbackErr) {
        setError(fallbackErr.message || 'Something went wrong while fetching weather data.')
      }
    } finally {
      setLoading(false)
      /* Keep isSearching true briefly so zoom animation plays */
      setTimeout(() => setIsSearching(false), 3500)
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) { loadWeather({ city: query }); return }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => loadWeather({ lat: coords.latitude,  lon: coords.longitude }),
      () => loadWeather({ city: query }),
      { timeout: 8000 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* ── Cinematic Intro ─────────────────────────────── */}
      <AnimatePresence>
        {!introComplete && (
          <motion.div
            className="intro-bg fixed inset-0 z-[100] flex flex-col items-center justify-center"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, filter: 'blur(8px)' }}
            transition={{ duration: 1.2, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
              <div style={{
                width: '60vw', height: '60vw', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(0,191,255,0.12) 0%, transparent 70%)',
                animation: 'orb-pulse 6s ease-in-out infinite',
              }} />
            </div>

            <motion.h1
              className="glow-accent text-accent relative z-10 text-center px-4 text-5xl tracking-widest sm:text-7xl md:text-8xl"
              style={{ fontFamily: "'Anton', sans-serif" }}
              initial={{ opacity: 0, scale: 0.85, filter: 'blur(16px)' }}
              animate={{ opacity: 1, scale: 1,    filter: 'blur(0px)' }}
              transition={{ duration: 1.4, delay: 0.2, ease: [0.32, 0.72, 0, 1] }}
            >
              AERVION DASHBOARD
            </motion.h1>

            <motion.div
              className="relative z-10 mt-4 h-px w-48"
              style={{ background: 'linear-gradient(to right, transparent, #00bfff, transparent)' }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 1, delay: 1, ease: [0.32, 0.72, 0, 1] }}
            />

            <motion.p
              className="relative z-10 mt-6 text-center text-sm font-semibold uppercase tracking-[0.4em] text-white/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1.4 }}
              onAnimationComplete={() => { setTimeout(() => setIntroComplete(true), 1200) }}
            >
              Created by Sayan Ghosh
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Aervion Header ──────────────────────────── */}
      <AnimatePresence>
        {introComplete && (
          <motion.header
            className="header-nav fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Brand */}
            <div className="flex items-center gap-3">
              <div className="header-logo-dot" aria-hidden />
              <span className="header-brand">AERVION</span>
            </div>
            {/* Tagline */}
            <span className="header-tagline hidden sm:block">Weather Intelligence</span>
          </motion.header>
        )}
      </AnimatePresence>

      <main
        className="relative min-h-screen w-full overflow-hidden text-white"
        style={{ '--accent': theme.accent, '--accent-glow': theme.glow, perspective: '1200px' }}
        onMouseMove={(e) => {
          setMouse({
            x: (e.clientX / window.innerWidth  - 0.5) * 2,
            y: (e.clientY / window.innerHeight - 0.5) * 2,
          })
        }}
      >
        <div className={`weather-fx weather-${weatherType}`} aria-hidden="true" />
        <div className="ambient-glow"   aria-hidden="true" />
        <div className="noise-overlay"  aria-hidden="true" />

        {/* 3D Earth Background */}
        <div className="absolute inset-0 -z-10 pointer-events-none">
          <Suspense fallback={null}>
            <WeatherScene
              weatherType={weatherType}
              mouse={mouse}
              cityCoords={cityCoords}
              isSearching={isSearching}
            />
          </Suspense>
        </div>

        {/* ── Main Content ──────────────────────────────── */}
        <motion.div
          className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pt-28 pb-12 lg:pt-36 lg:pb-24"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* ── Hero Card ─────────────────────────────── */}
          <motion.section variants={itemVariants} className="float-animate">
            <TiltCard className="glass-panel group relative p-10 sm:p-16">
              <div
                className="pointer-events-none absolute left-10 top-0 h-px w-24 opacity-60"
                style={{ background: 'linear-gradient(to right, transparent, var(--accent), transparent)' }}
                aria-hidden
              />
              <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative z-10">
                  <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.5em] text-white/30">
                    Atmospheric Monitor
                  </p>
                  <h1
                    className="font-light tracking-tighter"
                    style={{ fontSize: 'clamp(5rem, 14vw, 10rem)', lineHeight: 1 }}
                  >
                    {weather ? `${Math.round(weather.main.temp)}°` : '--°'}
                  </h1>
                  <div className="mt-8">
                    <p className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">
                      {weather?.name ?? 'Locating...'}{' '}
                      <span className="text-white/40">{weather?.sys?.country ?? ''}</span>
                    </p>
                    <p
                      className="mt-2 text-sm font-semibold uppercase tracking-[0.35em]"
                      style={{ color: 'var(--accent)', opacity: 0.85 }}
                    >
                      {weather?.weather?.[0]?.description ?? 'Awaiting data'}
                    </p>
                  </div>
                </div>

                <motion.div
                  className="weather-emoji relative z-20 text-[6rem] sm:text-[10rem] md:text-[12rem] opacity-90"
                  animate={{ y: [0, -18, 0] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {weatherIcon}
                </motion.div>
              </div>

              <AnimatePresence>
                {notice && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-6 right-8 text-[9px] font-bold uppercase tracking-[0.2em] text-white/25"
                  >
                    {notice}
                  </motion.div>
                )}
              </AnimatePresence>
            </TiltCard>
          </motion.section>

          {/* ── Error Banner ──────────────────────────── */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="glass-panel px-8 py-5 text-center text-sm font-medium text-blue-200/70"
                style={{ borderColor: 'rgba(0,191,255,0.25)' }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Search + Location ─────────────────────── */}
          <motion.section variants={itemVariants} className="relative z-20 flex flex-col gap-5 lg:flex-row">
            <form
              className="glass-panel input-glow-wrap flex flex-1 items-center gap-4 p-3 pl-6"
              onSubmit={(e) => { e.preventDefault(); if (query.trim()) loadWeather({ city: query.trim() }) }}
            >
              <svg className="h-4 w-4 shrink-0 text-white/25" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <circle cx="11" cy="11" r="8" /><path strokeLinecap="round" d="m21 21-4.35-4.35" />
              </svg>
              <input
                id="city-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search city..."
                aria-label="Search city"
                className="w-full bg-transparent py-2 text-lg font-light tracking-wide outline-none placeholder:text-white/20"
              />
              <motion.button
                whileHover={{ scale: 1.03, boxShadow: '0 0 24px -4px rgba(0,191,255,0.55)' }}
                whileTap={{ scale: 0.97 }}
                className="btn-blue rounded-2xl px-8 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-black"
                style={{ background: 'linear-gradient(135deg, #00bfff 0%, #3b82f6 100%)' }}
                type="submit"
                id="search-btn"
              >
                Discover
              </motion.button>
            </form>

            <motion.button
              whileHover={{ scale: 1.02, borderColor: 'rgba(0,191,255,0.4)', boxShadow: '0 0 30px -6px rgba(0,191,255,0.30)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!navigator.geolocation) { setError('Geolocation unavailable.'); return }
                navigator.geolocation.getCurrentPosition(
                  ({ coords }) => loadWeather({ lat: coords.latitude, lon: coords.longitude }),
                  () => setError('Location access denied.'),
                )
              }}
              id="location-btn"
              className="glass-panel btn-blue flex items-center justify-center gap-3 px-10 py-5 text-[10px] font-bold uppercase tracking-[0.25em] text-white/55 transition-all hover:text-white"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              Current Location
            </motion.button>
          </motion.section>

          {/* ── Stats Cards ───────────────────────────── */}
          <motion.section variants={containerVariants} className="relative z-10 grid gap-6 md:grid-cols-3">
            {(loading ? Array.from({ length: 3 }) : [
              { label: 'Humidity',   value: weather?.main?.humidity ? `${weather.main.humidity}%` : '--', icon: '💧' },
              { label: 'Atmosphere', value: weather?.weather?.[0]?.main ?? '--',                          icon: '🌐' },
              { label: 'Air Flow',   value: weather?.wind?.speed ? `${weather.wind.speed} m/s` : '--',    icon: '🌬️' },
            ]).map((item, index) => (
              <TiltCard key={index} className="glass-panel card-tilt">
                <motion.article
                  variants={itemVariants}
                  className="flex flex-col items-center justify-center p-8 text-center"
                >
                  {loading ? (
                    <div className="skeleton h-12 w-full" />
                  ) : (
                    <>
                      <span className="mb-3 text-2xl opacity-60">{item.icon}</span>
                      <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">{item.label}</p>
                      <p className="mt-3 text-4xl font-light tracking-tighter"
                         style={{ textShadow: '0 0 20px var(--accent-glow)' }}>
                        {item.value}
                      </p>
                    </>
                  )}
                </motion.article>
              </TiltCard>
            ))}
          </motion.section>

          {/* ── Forecast ──────────────────────────────── */}
          <motion.section variants={itemVariants} className="glass-panel card-tilt relative z-10 p-10 sm:p-12">
            <div
              className="pointer-events-none absolute left-12 top-0 h-px w-32 opacity-40"
              style={{ background: 'linear-gradient(to right, transparent, var(--accent), transparent)' }}
              aria-hidden
            />
            <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-3xl font-light tracking-tight text-white/90">Forecast</h2>
              <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/20">5-Day Outlook</span>
            </div>
            <div className="forecast-scroll flex gap-6 overflow-x-auto pb-4">
              {(loading ? Array.from({ length: 5 }) : forecastCards).map((item, index) => (
                <motion.article
                  key={item?.day ?? index}
                  variants={itemVariants}
                  whileHover={{ y: -4, transition: { duration: 0.3 } }}
                  className="flex min-w-[150px] flex-col items-center justify-center border-r border-white/5 pr-6 last:border-0 cursor-default"
                >
                  {loading ? (
                    <div className="skeleton h-32 w-full" />
                  ) : (
                    <>
                      <p className="text-xs font-semibold tracking-wider text-white/35">{item.day}</p>
                      <p className="my-5 text-5xl opacity-90">{item.icon}</p>
                      <p className="text-4xl font-light tracking-tighter"
                         style={{ textShadow: '0 0 16px var(--accent-glow)' }}>
                        {item.temp}°
                      </p>
                      <p className="mt-2 text-[9px] font-bold uppercase tracking-[0.2em] opacity-55"
                         style={{ color: 'var(--accent)' }}>
                        {item.desc}
                      </p>
                    </>
                  )}
                </motion.article>
              ))}
            </div>
          </motion.section>
        </motion.div>

        {/* ── Premium Footer ─────────────────────────────── */}
        <footer className="relative z-10 w-full pb-10 pt-4">
          {/* Separator */}
          <div
            className="mx-auto mb-10 h-px max-w-md"
            style={{ background: 'linear-gradient(to right, transparent, rgba(0,191,255,0.5), transparent)' }}
          />

          {/* Social Icons + Labels */}
          <div className="flex items-start justify-center gap-8 mb-8">
            {[
              { href: 'https://github.com/sayanghosh67/',           Icon: GithubIcon,   label: 'GitHub'    },
              { href: 'https://www.linkedin.com/in/sayan-ghosh97/', Icon: LinkedinIcon, label: 'LinkedIn'  },
              { href: 'https://www.instagram.com/sayan_ghosh97/',   Icon: InstagramIcon,label: 'Instagram' },
            ].map(({ href, Icon, label }) => (
              <motion.div
                key={label}
                className="flex flex-col items-center gap-2"
                whileHover={{ y: -2 }}
              >
                <motion.a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${label} — Sayan Ghosh`}
                  className="social-link"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Icon />
                </motion.a>
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.25em]"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  {label}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Divider */}
          <div
            className="mx-auto mb-5 h-px max-w-xs"
            style={{ background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.07), transparent)' }}
          />

          {/* Credit */}
          <p className="text-center text-[11px] font-semibold uppercase tracking-[0.3em] text-white/40">
            Designed &amp; Built by{' '}
            <span style={{ color: 'rgba(0,191,255,0.75)' }}>Sayan Ghosh</span>
          </p>
          <p className="mt-2 text-center text-[9px] font-medium uppercase tracking-[0.22em] text-white/20">
            &copy; 2026 Sayan Ghosh — All rights reserved
          </p>
        </footer>
      </main>
    </>
  )
}

export default App
