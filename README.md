# Neon 3D Weather Dashboard

Premium portfolio-style weather dashboard built with React, Tailwind CSS, Framer Motion, and React Three Fiber.

## Features

- Dark neon visual identity with glassmorphism, glow accents, and layered UI
- Animated hero with large temperature typography and weather-reactive lighting
- Lazy-loaded 3D floating orb background with parallax response
- Search by city + auto geolocation detection
- Current weather metrics (temperature, condition, humidity, wind)
- 5-day forecast in a horizontal animated card rail
- Dynamic atmosphere FX based on weather type (rain/sun/cloud/thunder)
- Loading skeleton shimmer and animated error state
- Responsive behavior with reduced visual intensity on smaller screens

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your environment file:

```bash
cp .env.example .env
```

3. Add your OpenWeather key in `.env`:

```bash
VITE_OPENWEATHER_API_KEY=your_real_key_here
```

4. Run development server:

```bash
npm run dev
```

## Build

```bash
npm run build
npm run preview
```
