// In-memory cache for fast responses
const cache = new Map();
const filmTreeCache = new Map();
const movieDetailsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;      // 5 minutes for full billboard
const TREE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes for film tree

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

async function getActiveFilmIds() {
  const ids = new Set();
  
  // Source 1: Voyalcine cinema 14 (Exact complex ID for Showcase Belgrano)
  try {
    const res = await fetch('https://api.voyalcine.net/films?cinemaId=14', { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      data.forEach(f => ids.add(f.id));
    }
  } catch (e) {
    console.warn('Voyalcine cinemaId=14 error:', e.message);
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

async function fetchFilmBelgranoData(filmId, targetDate) {
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

  const dayData = data.days && data.days[targetDate];
  if (!dayData) return null;

  const belgrano = dayData.find(c => c.name && c.name.toLowerCase().includes('belgrano'));
  if (!belgrano) return null;

  const formats = [];
  const allTimes = [];

  for (const f of belgrano.formats || []) {
    const times = (f.performances || []).map(p => p.showTime).sort();
    if (times.length > 0) {
      formats.push({
        format: f.formatDescription,
        times: times
      });
      allTimes.push(...times);
    }
  }

  if (formats.length === 0) return null;

  const uniqueSortedTimes = Array.from(new Set(allTimes)).sort();
  const details = await fetchFilmDetails(filmId);

  return {
    id: filmId,
    title: data.name,
    poster: `https://static.voyalcine.net/Uploads/i${filmId}.jpg`,
    buyUrl: `https://entradas.todoshowcase.com/showcase/pelicula.aspx?filmid=${filmId}`,
    formats: formats,
    times: uniqueSortedTimes,
    earliestTime: uniqueSortedTimes[0],
    latestTime: uniqueSortedTimes[uniqueSortedTimes.length - 1],
    duration: details.duration,
    genre: details.genre,
    rating: details.rating,
    director: details.director,
    cast: details.cast,
    synopsis: details.synopsis,
    trailerYoutubeId: details.trailerYoutubeId
  };
}

export async function getCarteleraBelgrano(requestedDate) {
  const todayAr = getArgentinaDateStr();
  const targetDate = requestedDate || todayAr;
  const isToday = targetDate === todayAr;
  const now = Date.now();

  const cached = cache.get(targetDate);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const filmIds = await getActiveFilmIds();
  const promises = filmIds.map(id => fetchFilmBelgranoData(id, targetDate));
  const settled = await Promise.allSettled(promises);

  const movies = settled
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value)
    .sort((a, b) => a.earliestTime.localeCompare(b.earliestTime));

  const currentTimeAr = getArgentinaTimeStr();

  const payload = {
    cinema: 'Showcase Belgrano',
    address: 'Monroe 1750, Belgrano, CABA',
    todayDate: todayAr,
    targetDate: targetDate,
    isToday: isToday,
    currentTime: currentTimeAr,
    totalMovies: movies.length,
    movies: movies,
    cachedAt: new Date().toISOString()
  };

  cache.set(targetDate, { timestamp: now, data: payload });
  return payload;
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
    const data = await getCarteleraBelgrano(dateParam);
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching cartelera:', error);
    return res.status(500).json({ error: 'Failed to fetch billboard data', details: error.message });
  }
}
