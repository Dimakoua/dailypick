// Fetch current weather from open-meteo and display it in the header.
// Caches results in localStorage for 10 minutes to avoid repeated calls.

const WEATHER_CACHE_KEY = 'dailypick-weather-cache';
const WEATHER_CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

const WEATHER_DEFAULT_COORDS = { latitude: 47.6062, longitude: -122.3321 }; // Seattle

function getWeatherEmoji(weatherCode) {
  // Open-Meteo weathercode mapping: https://open-meteo.com/en/docs
  if (weatherCode === 0) return '☀️';
  if (weatherCode === 1 || weatherCode === 2 || weatherCode === 3) return '⛅';
  if (weatherCode === 45 || weatherCode === 48) return '🌫️';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode)) return '🌧️';
  if ([56, 57, 66, 67, 85, 86].includes(weatherCode)) return '🌨️';
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return '❄️';
  if ([95, 96, 99].includes(weatherCode)) return '⛈️';
  return '🌤️';
}

function renderWeather(element, data) {
  if (!element || !data) return;
  const emoji = getWeatherEmoji(data.weathercode);
  const temp = Math.round(data.temperature);
  const unit = data.temperature_unit === 'fahrenheit' ? '°F' : '°C';
  element.textContent = `${emoji} ${temp}${unit}`;
}

function storeWeatherCache(data) {
  if (!data) return;
  const payload = {
    timestamp: Date.now(),
    data,
  };
  try {
    localStorage.setItem(WEATHER_CACHE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function loadWeatherCache() {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (Date.now() - (parsed.timestamp || 0) > WEATHER_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function fetchWeather(coords) {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(coords.latitude));
  url.searchParams.set('longitude', String(coords.longitude));
  url.searchParams.set('current_weather', 'true');
  url.searchParams.set('temperature_unit', 'celsius');

  const resp = await fetch(url.toString(), { cache: 'no-store' });
  if (!resp.ok) throw new Error(`Weather fetch failed: ${resp.status}`);
  const json = await resp.json();
  return json.current_weather;
}

async function initWeather() {
  const el = document.querySelector('#site-weather');
  if (!el) return;

  const cached = loadWeatherCache();
  if (cached) {
    renderWeather(el, cached);
    return;
  }

  let coords = WEATHER_DEFAULT_COORDS;

  // Resolve location via IP-based geo service; this avoids requiring browser permission.
  try {
    const resp = await fetch('https://ipapi.co/json/', { cache: 'no-store' });
    if (resp.ok) {
      const json = await resp.json();
      if (typeof json.latitude === 'number' && typeof json.longitude === 'number') {
        coords = { latitude: json.latitude, longitude: json.longitude };
      }
    }
  } catch {
    // ignore and use default coords
  }

  try {
    const weather = await fetchWeather(coords);
    if (weather) {
      renderWeather(el, weather);
      storeWeatherCache(weather);
    }
  } catch {
    // Fail silently; weather is an enhancement.
  }
}

window.addEventListener('DOMContentLoaded', initWeather);
