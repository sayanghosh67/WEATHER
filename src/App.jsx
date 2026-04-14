import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'framer-motion'

const WeatherScene = lazy(() => import('./components/WeatherScene'))

const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY
const WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather'
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast'
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast'

const weatherThemes = {
  clear: { accent: '#ffda47', glow: 'rgba(255, 218, 71, 0.45)', sceneBg: '#140f02' },
  clouds: { accent: '#a8c0ff', glow: 'rgba(168, 192, 255, 0.45)', sceneBg: '#0b101a' },
  rain: { accent: '#52b8ff', glow: 'rgba(82, 184, 255, 0.42)', sceneBg: '#060d16' },
  drizzle: { accent: '#66b8ff', glow: 'rgba(102, 184, 255, 0.42)', sceneBg: '#08101c' },
  thunderstorm: { accent: '#bd7eff', glow: 'rgba(189, 126, 255, 0.42)', sceneBg: '#120818' },
  snow: { accent: '#ffffff', glow: 'rgba(255, 255, 255, 0.5)', sceneBg: '#0f1620' },
  default: { accent: '#00dcff', glow: 'rgba(0, 220, 255, 0.42)', sceneBg: '#05080f' },
}

const iconMap = {
  clear: '☀️',
  clouds: '☁️',
  rain: '🌧️',
  drizzle: '🌦️',
  thunderstorm: '⛈️',
  snow: '❄️',
  default: '🌤️',
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
  const currentCode = data.current?.weather_code ?? 0
  const currentCondition = codeToCondition(currentCode)
  const weatherPayload = {
    name: cityLabel,
    sys: { country: countryCode ?? '' },
    main: {
      temp: data.current?.temperature_2m ?? 0,
      humidity: data.current?.relative_humidity_2m ?? 0,
    },
    wind: { speed: data.current?.wind_speed_10m ?? 0 },
    weather: [{ main: currentCondition.main, description: currentCondition.desc }],
  }

  const forecastPayload = (data.daily?.time ?? []).slice(0, 5).map((day, index) => {
    const code = data.daily?.weather_code?.[index] ?? 0
    const condition = codeToCondition(code)
    return {
      dt: Math.floor(new Date(day).getTime() / 1000),
      main: { temp: data.daily?.temperature_2m_max?.[index] ?? 0 },
      weather: [{ main: condition.main, description: condition.desc }],
    }
  })

  return { weatherPayload, forecastPayload }
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.2,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.92, rotateX: 10 },
  visible: { 
    opacity: 1, 
    y: 0, 
    scale: 1, 
    rotateX: 0,
    transition: { type: 'spring', stiffness: 120, damping: 20 }
  },
}

function App() {
  const [introComplete, setIntroComplete] = useState(false)
  const [query, setQuery] = useState('Tokyo')
  const [weather, setWeather] = useState(null)
  const [forecast, setForecast] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [mouse, setMouse] = useState({ x: 0, y: 0 })

  const weatherType = weather?.weather?.[0]?.main?.toLowerCase() ?? 'default'
  const theme = weatherThemes[weatherType] ?? weatherThemes.default
  const weatherIcon = iconMap[weatherType] ?? iconMap.default

  const forecastCards = useMemo(
    () =>
      forecast.map((item) => ({
        day: formatDay(item.dt),
        temp: Math.round(item.main.temp),
        icon: iconMap[item.weather?.[0]?.main?.toLowerCase()] ?? '🌤️',
        desc: item.weather?.[0]?.description ?? 'Unknown',
      })),
    [forecast],
  )

  const loadWeather = async ({ city, lat, lon }) => {
    setLoading(true)
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

        const forecastRes = await fetch(
          `${FORECAST_URL}?lat=${currentData.coord.lat}&lon=${currentData.coord.lon}&appid=${apiKey}&units=metric`,
        )

        if (!forecastRes.ok) {
          const forecastError = await forecastRes.json().catch(() => ({}))
          throw new Error(forecastError.message || 'Unable to load forecast right now.')
        }

        const forecastData = await forecastRes.json()
        const daily = forecastData.list.filter((_, index) => index % 8 === 0).slice(0, 5)
        setForecast(daily)
        setNotice('Live source: OpenWeather')
      } else {
        throw new Error('Missing API key. Add VITE_OPENWEATHER_API_KEY to your .env file.')
      }
    } catch (err) {
      const mainError = err.message || 'Weather service unavailable'
      
      // If it's a critical error like invalid key, don't just fallback silently if you want the user to know
      if (mainError.includes('API key') || mainError.includes('Unauthorized')) {
        setError(mainError)
        return // Stop here so they fix the key
      }

      try {
        // Fallback to Open-Meteo
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
          cityLabel: location.name,
          countryCode: location.country_code,
          data: meteoData,
        })

        setWeather(weatherPayload)
        setForecast(forecastPayload)
        setNotice('OpenWeather unavailable. Using backup weather source.')
      } catch (fallbackErr) {
        const fallbackMessage =
          fallbackErr.message || 'Something went wrong while fetching weather data.'
        setError(fallbackMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!navigator.geolocation) {
      loadWeather({ city: query })
      return
    }

    navigator.geolocation.getCurrentPosition(
      ({ coords }) => loadWeather({ lat: coords.latitude, lon: coords.longitude }),
      () => loadWeather({ city: query }),
      { timeout: 8000 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <AnimatePresence>
        {!introComplete && (
          <motion.div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505]"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeInOut' }}
          >
            <motion.h1
              className="heading-font text-center px-4 text-5xl tracking-widest text-[#38bdf8] drop-shadow-[0_0_30px_rgba(56,189,248,0.8)] sm:text-7xl md:text-8xl"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.2, delay: 0.2, ease: 'easeOut' }}
            >
              WEATHER DASHBOARD
            </motion.h1>
            <motion.p
              className="mt-6 text-center text-sm font-bold uppercase tracking-[0.4em] text-white/60"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1.4 }}
              onAnimationComplete={() => {
                setTimeout(() => setIntroComplete(true), 1500)
              }}
            >
              Created by Sayan Ghosh
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <main
      className="relative min-h-screen w-full overflow-hidden text-white"
      style={{ 
        '--accent': theme.accent, 
        '--accent-glow': theme.glow,
        perspective: '1200px'
      }}
      onMouseMove={(event) => {
        const x = (event.clientX / window.innerWidth - 0.5) * 2
        const y = (event.clientY / window.innerHeight - 0.5) * 2
        setMouse({ x, y })
      }}
    >
      <div className={`weather-fx weather-${weatherType}`} aria-hidden="true" />
      <div className="noise-overlay" aria-hidden="true" />
      
      {/* 3D Background Layer */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <Suspense fallback={null}>
          <WeatherScene weatherType={weatherType} mouse={mouse} />
        </Suspense>
      </div>

      {/* Main Content Layer with Parallax */}
      <motion.div 
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          rotateX: mouse.y * -2,
          rotateY: mouse.x * 2,
          transformStyle: 'preserve-3d'
        }}
      >
        <motion.section
          variants={itemVariants}
          whileHover={{ z: 20, scale: 1.01 }}
          className="glass-panel relative z-10 overflow-visible p-6 sm:p-10"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative z-10">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.4em] text-white/70">
                Neon Climate Console
              </p>
              <h1 className="heading-font text-6xl leading-[0.9] sm:text-8xl md:text-9xl drop-shadow-2xl">
                {weather ? `${Math.round(weather.main.temp)}°` : '--°'}
              </h1>
              <p className="mt-4 text-xl font-medium tracking-wide text-white/90 sm:text-3xl">
                {weather?.name ?? 'Detecting location'} {weather?.sys?.country ?? ''}
              </p>
              <p className="mt-1 text-sm font-medium uppercase tracking-[0.3em] text-[var(--accent)]">
                {weather?.weather?.[0]?.description ?? 'Awaiting atmosphere data'}
              </p>
            </div>

            <motion.div
              className="weather-emoji relative z-20 text-7xl sm:text-8xl md:text-9xl"
              animate={{ y: [0, -15, 0], rotateZ: [0, 5, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ transformStyle: 'preserve-3d' }}
            >
              {weatherIcon}
            </motion.div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="relative z-20 flex flex-col gap-4 lg:flex-row">
          <form
            className="glass-panel flex flex-1 items-center gap-3 p-3 transition-transform"
            whileHover={{ z: 15 }}
            onSubmit={(event) => {
              event.preventDefault()
              if (query.trim()) loadWeather({ city: query.trim() })
            }}
          >
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Enter city name..."
              className="w-full rounded-xl border border-transparent bg-white/5 px-5 py-4 text-sm font-medium tracking-wide outline-none transition duration-300 placeholder:text-white/40 focus:bg-white/10"
            />
            <motion.button
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px var(--accent-glow)' }}
              whileTap={{ scale: 0.95 }}
              className="relative overflow-hidden rounded-xl border border-white/20 bg-[var(--accent)] px-6 py-4 text-xs font-bold uppercase tracking-[0.2em] text-black shadow-lg"
              type="submit"
            >
              Search
            </motion.button>
          </form>

          <motion.button
            variants={itemVariants}
            whileHover={{ z: 15, scale: 1.02, backgroundColor: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (!navigator.geolocation) {
                setError('Geolocation is not available.')
                return
              }
              navigator.geolocation.getCurrentPosition(
                ({ coords }) => loadWeather({ lat: coords.latitude, lon: coords.longitude }),
                () => setError('Location access denied. Search city manually.'),
              )
            }}
            className="glass-panel flex items-center justify-center rounded-2xl px-8 py-4 text-xs font-bold uppercase tracking-[0.2em] text-white transition-colors"
          >
            Use My Location
          </motion.button>
        </motion.section>

        <AnimatePresence>
          {notice && !error && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className="glass-soft relative z-10 rounded-xl border-l-4 border-blue-400 p-4 text-sm font-medium tracking-wide text-blue-100"
            >
              {notice}
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, scale: 0.95 }}
              animate={{ opacity: 1, height: 'auto', scale: 1 }}
              exit={{ opacity: 0, height: 0, scale: 0.95 }}
              className="glass-soft relative z-10 rounded-xl border-l-4 border-red-500 p-4 text-sm font-medium tracking-wide text-red-100"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.section variants={containerVariants} className="relative z-10 grid gap-5 md:grid-cols-3">
          {(loading ? Array.from({ length: 3 }) : [
            { label: 'Humidity', value: weather?.main?.humidity ? `${weather.main.humidity}%` : '--', delay: 0 },
            { label: 'Condition', value: weather?.weather?.[0]?.main ?? '--', delay: 0.1 },
            { label: 'Wind Speed', value: weather?.wind?.speed ? `${weather.wind.speed} m/s` : '--', delay: 0.2 }
          ]).map((item, index) => (
            <motion.article
              key={index}
              variants={itemVariants}
              whileHover={{ z: 20, rotateX: 6, rotateY: -6, scale: 1.05 }}
              className="glass-panel flex min-h-[140px] flex-col justify-center p-6"
            >
              {loading ? (
                <div className="skeleton h-full w-full rounded-xl" />
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.25em] text-white/50">{item.label}</p>
                  <p className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl capitalize">{item.value}</p>
                </>
              )}
            </motion.article>
          ))}
        </motion.section>

        <motion.section
          variants={itemVariants}
          whileHover={{ z: 10 }}
          className="glass-panel relative z-10 p-6 sm:p-8"
        >
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="heading-font text-2xl tracking-wider text-white/90">5-Day Outlook</h2>
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-white/40">Hourly Sampled</span>
          </div>
          <div className="forecast-scroll flex gap-4 overflow-x-auto pb-4 pt-2">
            {(loading ? Array.from({ length: 5 }) : forecastCards).map((item, index) => (
              <motion.article
                key={item?.day ?? index}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + index * 0.1, type: 'spring' }}
                whileHover={{ y: -10, scale: 1.05, z: 20 }}
                className="glass-soft flex min-w-[150px] flex-col items-center justify-center rounded-2xl p-5"
              >
                {loading ? (
                  <div className="skeleton h-28 w-full rounded-xl" />
                ) : (
                  <>
                    <p className="text-sm font-semibold tracking-wider text-white/60">{item.day}</p>
                    <p className="my-3 text-4xl drop-shadow-lg">{item.icon}</p>
                    <p className="text-3xl font-bold">{item.temp}°</p>
                    <p className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">
                      {item.desc}
                    </p>
                  </>
                )}
              </motion.article>
            ))}
          </div>
        </motion.section>
      </motion.div>

      {/* Global Footer */}
      <footer className="relative z-10 w-full pb-6 text-center text-xs font-bold uppercase tracking-[0.2em] text-white/30">
        copyright by sayan ghosh
      </footer>
    </main>
    </>
  )
}

export default App
