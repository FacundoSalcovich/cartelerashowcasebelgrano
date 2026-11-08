// In-memory cache for fast responses
const cache = new Map();
const filmTreeCache = new Map();
const movieDetailsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;      // 5 minutes for full billboard
const TREE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for film tree

// Showcase complexes in Argentina (Official Voyalcine / Showcase IDs)
export const CINEMAS = [
  {
    id: 14,
    slug: 'belgrano',
    name: 'Showcase Belgrano',
    shortName: 'Belgrano',
    location: 'Belgrano, CABA',
    address: 'Monroe 1750, Ciudad Autónoma de Buenos Aires',
    mapsQuery: 'Showcase Cinemas Belgrano Monroe 1750'
  },
  {
    id: 13,
    slug: 'norcenter',
    name: 'Showcase Norcenter',
    shortName: 'Norcenter',
    location: 'Vicente López, GBA',
    address: 'Esteban Echeverría 3750, Vicente López, Prov. de Buenos Aires',
    mapsQuery: 'Showcase Cinemas Norcenter Esteban Echeverria 3750'
  },
  {
    id: 18,
    slug: 'imax',
    name: 'IMAX Theatre (Norcenter)',
    shortName: 'IMAX Norcenter',
    location: 'Vicente López, GBA',
    address: 'Esteban Echeverría 3750, Vicente López, Prov. de Buenos Aires',
    mapsQuery: 'IMAX Theatre Norcenter Esteban Echeverria 3750'
  },
  {
    id: 11,
    slug: 'haedo',
    name: 'Showcase Haedo',
    shortName: 'Haedo',
    location: 'Haedo, GBA Oeste',
    address: 'Av. Dr. Luis Güemes 393, Haedo (Plaza Oeste Shopping)',
    mapsQuery: 'Showcase Cinemas Haedo Plaza Oeste'
  },
  {
    id: 15,
    slug: 'quilmes',
    name: 'Showcase Quilmes',
    shortName: 'Quilmes',
    location: 'Quilmes, GBA Sur',
    address: 'Humberto 1° 299, Quilmes (Quilmes Factory)',
    mapsQuery: 'Showcase Cinemas Quilmes Factory'
  },
  {
    id: 12,
    slug: 'cordoba',
    name: 'Showcase Córdoba (Villa Cabrera)',
    shortName: 'Córdoba (Villa Cabrera)',
    location: 'Córdoba Capital',
    address: 'José Antonio de Goyechea 2851, Córdoba (Córdoba Shopping)',
    mapsQuery: 'Showcase Cinemas Cordoba Villa Cabrera'
  },
  {
    id: 17,
    slug: 'villa-allende',
    name: 'Showcase Villa Allende',
    shortName: 'Villa Allende (Córdoba)',
    location: 'Villa Allende, Córdoba',
    address: 'Av. Padre Luchesse 3000, Villa Allende (VAS Shopping)',
    mapsQuery: 'Showcase Cinemas Villa Allende Shopping'
  },
  {
    id: 16,
    slug: 'rosario',
    name: 'Showcase Rosario',
    shortName: 'Rosario',
    location: 'Rosario, Santa Fe',
    address: 'Junín 501, Rosario, Santa Fe (Alto Rosario Shopping)',
    mapsQuery: 'Showcase Cinemas Rosario Alto Rosario'
  }
];

export function resolveCinema(cinemaParam) {
  if (!cinemaParam) return CINEMAS[0]; // Default: Showcase Belgrano
  const paramStr = String(cinemaParam).toLowerCase().trim();
  const byId = CINEMAS.find(c => String(c.id) === paramStr);
  if (byId) return byId;
  const bySlug = CINEMAS.find(c => c.slug === paramStr || c.shortName.toLowerCase() === paramStr);
  if (bySlug) return bySlug;
  const byName = CINEMAS.find(c => c.name.toLowerCase().includes(paramStr));
  if (byName) return byName;
  return CINEMAS[0];
}

function getArgentinaDateStr() {
  const d = new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d);
}

function getArgentinaTimeStr() {
  const d = new Date();
  return new Intl.DateTimeFormat('en-GB', { 
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

async function getActiveFilmIds(cinemaId = 14) {
  const ids = new Set();
  
  // Source 1: Voyalcine for the specific cinema
  try {
    const res = await fetch(`https://api.voyalcine.net/films?cinemaId=${cinemaId}`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      data.forEach(f => ids.add(f.id));
    }
  } catch (e) {
    console.warn(`Voyalcine cinemaId=${cinemaId} error:`, e.message);
  }

  // Source 2: Showcase official homepage
  try {
    const res = await fetch('https://entradas.todoshowcase.com/showcase/', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const html = await res.text();
      const matches = Array.from(html.matchAll(/filmid=(\d+)/g)).map(m => parseInt(m[1]));
      matches.forEach(id => ids.add(id));
    }
  } catch (err) {
    console.warn('Showcase homepage scraper error:', err.message);
  }
  
  // Source 3: Safe fallback of known film IDs
  const fallback = [6291, 6277, 6278, 6275, 6276, 6252, 6255, 6250, 6251, 6236, 6234, 6220, 6203, 6209, 6191, 6194, 6177, 6154, 6156, 6101, 6102, 6082, 6083, 6060, 5984, 5927, 5875];
  fallback.forEach(id => ids.add(id));

  return Array.from(ids);
}

async function fetchFilmDetails(filmId) {
  if (movieDetailsCache.has(filmId)) {
    return movieDetailsCache.get(filmId);
  }
  try {
    const res = await fetch(`https://entradas.todoshowcase.com/showcase/pelicula.aspx?filmid=${filmId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const synMatch = html.match(/<p class="description">([\s\S]*?)<\/p>/i);
    const durMatch = html.match(/<strong>Duraci[oó]n:?<\/strong>\s*(\d+)\s*minutos/i) || html.match(/(\d+)\s*minutos/i);
    const genMatch = html.match(/<strong>G[eé]nero:?<\/strong>\s*([^<]+)/i) || html.match(/<div class="tags">([^<]+)<\/div>/i);
    const ratMatch = html.match(/<strong>Calificaci[oó]n:?<\/strong>\s*([^<]+)/i);
    const dirMatch = html.match(/<strong>Director:?<\/strong>\s*([^<]+)/i);
    const castMatch = html.match(/<strong>(?:Actores|Elenco):?<\/strong>\s*([^<]+)/i);
    const ytMatch = html.match(/(?:youtube\.com\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/i);

    const details = {
      duration: durMatch ? parseInt(durMatch[1]) : 110,
      genre: genMatch ? genMatch[1].trim() : 'Cine',
      rating: ratMatch ? ratMatch[1].trim() : 'ATP',
      director: dirMatch ? dirMatch[1].trim().replace(/\s+/g, ' ') : null,
      cast: castMatch ? castMatch[1].trim().replace(/\s+/g, ' ') : null,
      synopsis: synMatch ? synMatch[1].trim().replace(/\s+/g, ' ') : '',
      trailerYoutubeId: ytMatch ? ytMatch[1] : null
    };

    movieDetailsCache.set(filmId, details);
    return details;
  } catch (err) {
    const fallback = {
      duration: 110,
      genre: 'Cine',
      rating: 'ATP',
      director: null,
      cast: null,
      synopsis: '',
      trailerYoutubeId: null
    };
    movieDetailsCache.set(filmId, fallback);
    return fallback;
  }
}

async function fetchFilmDataForCinema(filmId, targetDate, cinema) {
  let data = null;

  // Check film tree cache first
  const cachedTree = filmTreeCache.get(filmId);
  if (cachedTree && Date.now() - cachedTree.timestamp < TREE_CACHE_TTL_MS) {
    data = cachedTree.data;
  } else {
    // Fetch with retry and 8-second timeout
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const url = `https://api.voyalcine.net/films/${filmId}/tree/showcase`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (res.ok) {
          data = await res.json();
          filmTreeCache.set(filmId, { timestamp: Date.now(), data });
          break;
        }
      } catch (err) {
        if (attempt === 1 && cachedTree) {
          data = cachedTree.data; // fallback to stale cache
        }
      }
    }
  }

  if (!data) return null;

  // Extract full weekly schedule for this cinema across all available dates
  const weeklySchedule = [];
  const sortedDates = Object.keys(data.days || {}).sort();

  for (const dt of sortedDates) {
    const dayCinemas = data.days[dt] || [];
    const cinemaMatch = dayCinemas.find(c => c.id === cinema.id) ||
      dayCinemas.find(c => c.name && c.name.toLowerCase().includes(cinema.shortName.toLowerCase()));
    if (!cinemaMatch) continue;

    const dayFormats = [];
    for (const f of cinemaMatch.formats || []) {
      const rawPerfs = Array.isArray(f.performances) ? f.performances : [];
      const performances = rawPerfs.map(p => ({
        time: p.showTime,
        perfId: p.performanceId,
        buyUrl: `https://entradas.todoshowcase.com/showcase/pelicula.aspx?filmid=${filmId}&perf=${p.performanceId}&cinema=${cinema.id}&date=${dt}&show=${f.showId || ''}`
      })).sort((a, b) => a.time.localeCompare(b.time));

      const times = performances.map(p => p.time);
      if (times.length > 0) {
        dayFormats.push({
          format: f.formatDescription,
          showId: f.showId || '',
          times: times,
          performances: performances
        });
      }
    }

    if (dayFormats.length > 0) {
      weeklySchedule.push({
        date: dt,
        formats: dayFormats
      });
    }
  }

  // If the movie has no scheduled showtimes in this cinema at all this week
  if (weeklySchedule.length === 0) return null;

  // Formats specifically for requested targetDate
  const targetDayEntry = weeklySchedule.find(s => s.date === targetDate);
  const isScheduledToday = Boolean(targetDayEntry);
  const formats = targetDayEntry ? targetDayEntry.formats : [];
  const allTimes = [];
  for (const f of formats) {
    allTimes.push(...f.times);
  }

  const uniqueSortedTimes = Array.from(new Set(allTimes)).sort();
  const details = await fetchFilmDetails(filmId);

  return {
    id: filmId,
    title: data.name,
    poster: `https://static.voyalcine.net/Uploads/i${filmId}.jpg`,
    buyUrl: `https://entradas.todoshowcase.com/showcase/pelicula.aspx?filmid=${filmId}`,
    isScheduledToday: isScheduledToday,
    formats: formats,
    times: uniqueSortedTimes,
    earliestTime: uniqueSortedTimes[0] || null,
    latestTime: uniqueSortedTimes[uniqueSortedTimes.length - 1] || null,
    availableDates: weeklySchedule.map(s => s.date),
    weeklySchedule: weeklySchedule,
    duration: details.duration,
    genre: details.genre,
    rating: details.rating,
    director: details.director,
    cast: details.cast,
    synopsis: details.synopsis,
    trailerYoutubeId: details.trailerYoutubeId
  };
}

export async function getCartelera(requestedDate, requestedCinema = 14) {
  const cinemaInfo = resolveCinema(requestedCinema);
  const todayAr = getArgentinaDateStr();
  const isAllWeek = requestedDate === 'all';
  const targetDate = isAllWeek ? todayAr : (requestedDate || todayAr);
  const isToday = !isAllWeek && targetDate === todayAr;
  const now = Date.now();
  const cacheKey = `${cinemaInfo.id}_${isAllWeek ? 'all' : targetDate}`;

  const cached = cache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const filmIds = await getActiveFilmIds(cinemaInfo.id);
  const promises = filmIds.map(id => fetchFilmDataForCinema(id, targetDate, cinemaInfo));
  const settled = await Promise.allSettled(promises);

  const allMovies = settled
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);

  // Extract all distinct dates across movies that actually have published showtimes in Showcase
  const allPublishedDates = Array.from(
    new Set(allMovies.flatMap(m => m.availableDates || []))
  ).sort();

  // Movies for the requested date/view
  const moviesForDate = isAllWeek
    ? allMovies.sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }))
    : allMovies
        .filter(m => m.isScheduledToday)
        .sort((a, b) => (a.earliestTime || '').localeCompare(b.earliestTime || ''));

  // Movies active in the cinema this week but scheduled for other days
  const otherWeekMovies = isAllWeek
    ? []
    : allMovies
        .filter(m => !m.isScheduledToday)
        .sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));

  const currentTimeAr = getArgentinaTimeStr();

  const payload = {
    cinema: cinemaInfo.name,
    cinemaId: cinemaInfo.id,
    cinemaSlug: cinemaInfo.slug,
    cinemaShortName: cinemaInfo.shortName,
    location: cinemaInfo.location,
    address: cinemaInfo.address,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cinemaInfo.mapsQuery)}`,
    availableCinemas: CINEMAS.map(c => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      shortName: c.shortName,
      location: c.location
    })),
    todayDate: todayAr,
    targetDate: isAllWeek ? 'all' : targetDate,
    isToday: isToday,
    isAllWeek: isAllWeek,
    publishedDates: allPublishedDates,
    currentTime: currentTimeAr,
    totalMovies: moviesForDate.length,
    movies: moviesForDate,
    otherWeekMovies: otherWeekMovies,
    allWeekMovies: allMovies,
    cachedAt: new Date().toISOString()
  };

  cache.set(cacheKey, { timestamp: now, data: payload });
  return payload;
}

// Backwards compatibility alias
export async function getCarteleraBelgrano(requestedDate) {
  return getCartelera(requestedDate, 14);
}

export default async function handler(req, res) {
  // CORS & CDN Caching headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const dateParam = url.searchParams.get('date');
    const cinemaParam = url.searchParams.get('cinema') || url.searchParams.get('cinemaId') || '14';
    const data = await getCartelera(dateParam, cinemaParam);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching cartelera:', error);
    return res.status(500).json({ error: 'Failed to fetch billboard data', details: error.message });
  }
}
