/**
 * Cartelera Showcase - Frontend Client
 * Pure modern vanilla JS, Zero external runtime libraries
 */

// Application State
const state = {
  selectedDate: null,
  selectedCinema: (() => {
    try {
      return localStorage.getItem('cartelera_cinema') || '14';
    } catch {
      return '14';
    }
  })(),
  availableCinemas: [],
  filters: {
    language: 'all',            // 'all' | 'sub' | 'dob'
    timeBand: 'all',            // 'all' | '15' (15:00+) | '18' (18:00+) | '20' (20:00+) | '22' (22:00+)
    format: 'all'               // 'all' | '2d' | '3d'
  },
  searchQuery: '',
  modalSelectedTime: null,      // Specific showtime selected inside modal for WhatsApp sharing
  modalSelectedFormat: null,    // Format of the selected showtime (e.g. 2D Subtitulado)
  cache: new Map(),
  currentData: null,
  isLoading: false,
};

// Crisp SVG Icons (monochrome, zero CDN dependencies)
const ICONS = {
  search: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  clock: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
  ticket: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"></rect><circle cx="12" cy="12" r="2"></circle><path d="M6 12h.01M18 12h.01"></path></svg>`,
  info: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  whatsapp: `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.4-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.43.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.43 1.02 2.6c.13.17 1.77 2.7 4.28 3.79.6.26 1.07.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.18-.47-.3"></path></svg>`,
  play: `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`
};

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDuration(minutes) {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * Normalizes format names into clean readable text for user display & sharing
 * e.g. "2D-SUBTITULADO" -> "2D Subtitulado", "2D-DOBLADA" -> "2D Doblada"
 */
function formatFormatName(fmtName) {
  if (!fmtName) return '';
  return fmtName
    .split(/[-_ ]+/)
    .map(word => {
      const lower = word.toLowerCase();
      if (lower === '2d' || lower === '3d') return lower.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Formats an ISO date into a localized friendly day string for invitation
 */
function formatInvitationDate(isoDate) {
  if (!isoDate) return 'Hoy';
  const now = new Date();
  const arDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(now);
  
  const [tY, tM, tD] = arDateStr.split('-').map(Number);
  const [sY, sM, sD] = isoDate.split('-').map(Number);
  
  const todayUtc = Date.UTC(tY, tM - 1, tD);
  const selUtc = Date.UTC(sY, sM - 1, sD);
  const diffDays = Math.round((selUtc - todayUtc) / (1000 * 60 * 60 * 24));

  const targetDateObj = new Date(selUtc + (12 * 60 * 60 * 1000));
  const weekdayStr = new Intl.DateTimeFormat('es-AR', { weekday: 'long' }).format(targetDateObj);
  const monthStr = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(targetDateObj);
  const capWeekday = weekdayStr.charAt(0).toUpperCase() + weekdayStr.slice(1);
  const dateFormatted = `${capWeekday} ${sD} de ${monthStr}`;

  if (diffDays === 0) {
    return `Hoy (${dateFormatted})`;
  } else if (diffDays === 1) {
    return `Mañana (${dateFormatted})`;
  } else {
    return dateFormatted;
  }
}

/**
 * Calculates ending time of a function taking into account 15 min of pre-show ads/trailers
 */
function calculateEndTime(showTimeStr, durationMinutes, adsMinutes = 15) {
  if (!showTimeStr) return '';
  const [h, m] = showTimeStr.split(':').map(Number);
  const total = h * 60 + m + adsMinutes + (durationMinutes || 110);
  const endH = Math.floor(total / 60) % 24;
  const endM = total % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

/**
 * Always gets the EXACT LIVE current time in Argentina timezone
 */
function getLiveArgentinaTime() {
  const d = new Date();
  return new Intl.DateTimeFormat('en-GB', { 
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d);
}

function timeStringToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTimeString(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getFilterDescription() {
  const parts = [];
  if (state.filters.language === 'sub') parts.push('Subtituladas');
  if (state.filters.language === 'dob') parts.push('Dobladas');
  if (state.filters.format === '2d') parts.push('en 2D');
  if (state.filters.format === '3d') parts.push('en 3D');
  if (state.filters.timeBand === '15') parts.push('desde 15:00 hs');
  if (state.filters.timeBand === '18') parts.push('desde 18:00 hs');
  if (state.filters.timeBand === '20') parts.push('desde 20:00 hs');
  if (state.filters.timeBand === '22') parts.push('desde 22:00 hs');
  return parts.join(' ');
}

/**
 * Calculates minute difference between showTime and current live Buenos Aires time
 */
function getTimeDifferenceMinutes(showTimeStr, currentTimeStr) {
  if (!showTimeStr || !currentTimeStr) return -9999;
  const [sH, sM] = showTimeStr.split(':').map(Number);
  const [cH, cM] = currentTimeStr.split(':').map(Number);
  return (cH * 60 + cM) - (sH * 60 + sM);
}

/**
 * Initializes the 7-day selector tabs in Argentina Time
 */
function initDateTabs() {
  const container = document.getElementById('dateTabs');
  if (!container) return;

  container.innerHTML = '';
  
  // Argentina reference date
  const now = new Date();
  const arDateFormatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Argentina/Buenos_Aires', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  });
  const todayArStr = arDateFormatter.format(now); // "YYYY-MM-DD"
  const [tY, tM, tD] = todayArStr.split('-').map(Number);

  const dateOptions = [];

  for (let i = 0; i < 7; i++) {
    const target = new Date(Date.UTC(tY, tM - 1, tD + i, 12, 0, 0));
    const year = target.getUTCFullYear();
    const month = String(target.getUTCMonth() + 1).padStart(2, '0');
    const day = String(target.getUTCDate()).padStart(2, '0');
    const isoDate = `${year}-${month}-${day}`;

    let label = '';
    const sublabel = `${day}/${month}`;

    if (i === 0) {
      label = 'Hoy';
    } else if (i === 1) {
      label = 'Mañana';
    } else {
      const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'America/Argentina/Buenos_Aires' }).format(target);
      label = weekday.charAt(0).toUpperCase() + weekday.slice(1, 3);
    }

    dateOptions.push({ isoDate, label, sublabel });
  }

  state.selectedDate = dateOptions[0].isoDate;

  dateOptions.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `date-tab ${idx === 0 ? 'is-active' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', idx === 0 ? 'true' : 'false');
    btn.setAttribute('tabindex', idx === 0 ? '0' : '-1');
    btn.dataset.date = opt.isoDate;
    btn.innerHTML = `<span>${opt.label}</span><span class="date-sublabel">${opt.sublabel}</span>`;

    btn.addEventListener('click', () => {
      if (state.selectedDate === opt.isoDate && !state.isLoading) return;
      selectDate(opt.isoDate, btn);
    });

    // Keyboard navigation (Left / Right arrow between tabs)
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const tabs = Array.from(container.querySelectorAll('.date-tab'));
        const curIdx = tabs.indexOf(btn);
        let nextIdx = e.key === 'ArrowRight' ? curIdx + 1 : curIdx - 1;
        if (nextIdx >= tabs.length) nextIdx = 0;
        if (nextIdx < 0) nextIdx = tabs.length - 1;
        tabs[nextIdx].focus();
        tabs[nextIdx].click();
      }
    });

    container.appendChild(btn);
  });
}

function selectDate(dateIso, clickedBtn) {
  state.selectedDate = dateIso;
  
  const allTabs = document.querySelectorAll('.date-tab');
  allTabs.forEach(t => {
    t.classList.remove('is-active');
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
  });

  if (clickedBtn) {
    clickedBtn.classList.add('is-active');
    clickedBtn.setAttribute('aria-selected', 'true');
    clickedBtn.setAttribute('tabindex', '0');
    clickedBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }

  fetchCartelera(false);
}

function selectToday() {
  const firstTab = document.querySelector('.date-tab');
  if (firstTab) firstTab.click();
}

function selectTomorrow() {
  const tabs = document.querySelectorAll('.date-tab');
  if (tabs && tabs.length > 1) {
    tabs[1].click();
  }
}
window.selectToday = selectToday;
window.selectTomorrow = selectTomorrow;

/**
 * Fetches billboard data for selectedDate and selectedCinema
 */
async function fetchCartelera(forceReload = false) {
  if (state.isLoading) return;

  const cacheKey = `${state.selectedCinema}_${state.selectedDate}`;

  // Use client-side cached data if available and not forced
  if (!forceReload && state.cache.has(cacheKey)) {
    state.currentData = state.cache.get(cacheKey);
    updateFooterAndHeader(state.currentData);
    renderBillboard();
    return;
  }

  state.isLoading = true;
  renderSkeletons();

  try {
    const res = await fetch(`/api/cartelera?date=${state.selectedDate}&cinema=${state.selectedCinema}`);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const data = await res.json();

    state.currentData = data;
    if (data.availableCinemas && data.availableCinemas.length > 0) {
      state.availableCinemas = data.availableCinemas;
      renderCinemaDropdown();
    }
    updateFooterAndHeader(data);
    state.cache.set(cacheKey, data);
    renderBillboard();
  } catch (err) {
    console.error('Error fetching cartelera:', err);
    renderErrorState(err.message);
  } finally {
    state.isLoading = false;
  }
}

/**
 * Skeleton Loader
 */
function renderSkeletons() {
  const container = document.getElementById('movieGrid');
  if (!container) return;

  container.innerHTML = Array.from({ length: 6 }).map(() => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton-poster"></div>
      <div class="skeleton-details">
        <div class="skeleton-line" style="width: 70%; height: 18px;"></div>
        <div class="skeleton-line" style="width: 40%; height: 13px;"></div>
        <div style="margin-top: 10px; display: flex; gap: 6px;">
          <div class="skeleton-line" style="width: 58px; height: 32px;"></div>
          <div class="skeleton-line" style="width: 58px; height: 32px;"></div>
        </div>
      </div>
    </div>
  `).join('');

  const countEl = document.getElementById('resultsCount');
  if (countEl) {
    countEl.textContent = 'Consultando cartelera oficial en vivo...';
  }
}

/**
 * Error state
 */
function renderErrorState(errorMessage) {
  const container = document.getElementById('movieGrid');
  if (!container) return;

  const countEl = document.getElementById('resultsCount');
  if (countEl) countEl.textContent = 'Error de conexión';

  container.innerHTML = `
    <div class="state-message" style="grid-column: 1 / -1;">
      <div class="state-icon-box">
        ${ICONS.ticket}
      </div>
      <h3 class="state-title">No pudimos conectar con Showcase</h3>
      <p class="state-desc">Hubo un inconveniente al consultar la cartelera. Por favor reintentá nuevamente.</p>
      <button type="button" class="btn-secondary" onclick="fetchCartelera(true)" style="margin-top: 8px;">
        Reintentar
      </button>
    </div>
  `;
}

/**
 * Main render function
 */
function renderBillboard() {
  const container = document.getElementById('movieGrid');
  if (!container || !state.currentData) return;

  const { movies } = state.currentData;
  const isToday = Boolean(state.currentData.isToday);
  const currentLiveTime = getLiveArgentinaTime();
  const query = state.searchQuery.toLowerCase().trim();

  let totalAvailableFunctions = 0;
  const processedMovies = [];

  for (const movie of movies) {
    // Title filter
    if (query && !movie.title.toLowerCase().includes(query)) {
      continue;
    }

    const validFormats = [];
    const allValidUpcomingTimes = [];

    for (const fmt of movie.formats) {
      const desc = fmt.format.toLowerCase();
      const is3D = desc.includes('3d');
      const is2D = desc.includes('2d') || !is3D;
      const isSub = desc.includes('sub');
      const isDob = desc.includes('dob') || desc.includes('cast') || desc.includes('español') || !isSub;

      // Language filter
      if (state.filters.language === 'sub' && !isSub) continue;
      if (state.filters.language === 'dob' && !isDob) continue;

      // Format filter
      if (state.filters.format === '2d' && !is2D) continue;
      if (state.filters.format === '3d' && !is3D) continue;

      const formatTimes = [];

      for (const timeStr of fmt.times) {
        // Time band filter
        const showMinutes = timeStringToMinutes(timeStr);
        let minMinutes = 0;
        if (state.filters.timeBand === '15') minMinutes = 900;       // 15:00
        else if (state.filters.timeBand === '18') minMinutes = 1080; // 18:00
        else if (state.filters.timeBand === '20') minMinutes = 1200; // 20:00
        else if (state.filters.timeBand === '22') minMinutes = 1320; // 22:00

        if (minMinutes > 0 && showMinutes < minMinutes) {
          continue;
        }

        // Accurately calculate diff against LIVE current time in Argentina
        const diffMinutes = isToday ? getTimeDifferenceMinutes(timeStr, currentLiveTime) : -999;
        
        // Exclude shows that started more than 15 minutes ago
        if (diffMinutes > 15) {
          continue;
        }

        const isStarted = diffMinutes >= 0 && diffMinutes <= 15;
        formatTimes.push({
          time: timeStr,
          isStarted,
          diffMinutes
        });

        if (!isStarted) {
          totalAvailableFunctions++;
          allValidUpcomingTimes.push(timeStr);
        }
      }

      if (formatTimes.length > 0) {
        validFormats.push({
          format: fmt.format,
          times: formatTimes
        });
      }
    }

    if (validFormats.length > 0) {
      allValidUpcomingTimes.sort();
      const earliestUpcoming = allValidUpcomingTimes[0] || null;

      processedMovies.push({
        ...movie,
        formats: validFormats,
        earliestUpcoming
      });
    }
  }

  // Alphabetical sort (A-Z) by movie title
  processedMovies.sort((a, b) => {
    return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
  });

  // Update statistics banner with clearly separated states
  updateStats(processedMovies.length, totalAvailableFunctions);

  // Clear, contextual empty states
  if (processedMovies.length === 0) {
    if (query) {
      container.innerHTML = `
        <div class="state-message" style="grid-column: 1 / -1;">
          <div class="state-icon-box">
            ${ICONS.search}
          </div>
          <h3 class="state-title">No encontramos películas para "${escapeHtml(state.searchQuery.trim())}"</h3>
          <p class="state-desc">Revisá si el título está bien escrito o intentá buscar otra película de la cartelera.</p>
          <button type="button" class="btn-secondary" onclick="resetSearch()" style="margin-top: 8px;">
            ${ICONS.close} Limpiar búsqueda
          </button>
        </div>
      `;
    } else {
      const filterDesc = getFilterDescription();
      const hasFiltersApplied = Boolean(filterDesc);

      if (hasFiltersApplied) {
        container.innerHTML = `
          <div class="state-message" style="grid-column: 1 / -1;">
            <div class="state-icon-box">
              ${ICONS.ticket}
            </div>
            <h3 class="state-title">No hay funciones disponibles con este filtro</h3>
            <p class="state-desc">Para la fecha seleccionada no hay funciones${filterDesc ? ` en formato ${filterDesc}` : ''}.</p>
            <button type="button" class="btn-secondary" onclick="resetAllFilters()" style="margin-top: 8px;">
              Restablecer filtros
            </button>
          </div>
        `;
      } else if (isToday) {
        container.innerHTML = `
          <div class="state-message" style="grid-column: 1 / -1;">
            <div class="state-icon-box">
              ${ICONS.clock}
            </div>
            <h3 class="state-title">Ya no quedan funciones por hoy</h3>
            <p class="state-desc">Todas las funciones programadas para el día de hoy ya comenzaron o finalizaron. Podés consultar la cartelera de mañana.</p>
            <button type="button" class="btn-secondary" onclick="selectTomorrow()" style="margin-top: 8px;">
              Ver funciones de mañana
            </button>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="state-message" style="grid-column: 1 / -1;">
            <div class="state-icon-box">
              ${ICONS.clock}
            </div>
            <h3 class="state-title">Sin funciones programadas para esta fecha</h3>
            <p class="state-desc">El cine aún no publicó los horarios para este día. Probá seleccionando hoy u otra fecha.</p>
            <button type="button" class="btn-secondary" onclick="selectToday()" style="margin-top: 8px;">
              Ver funciones de hoy
            </button>
          </div>
        `;
      }
      return;
    }
    return;
  }

  // Render cards (Uncropped 2:3 poster centered vertically, natural spacing, clean times only)
  container.innerHTML = '';
  processedMovies.forEach(movie => {
    const card = document.createElement('article');
    card.className = 'movie-card';
    card.dataset.movieId = movie.id;

    // Click on card opens the Movie Detail Modal (unless clicking direct ticket purchase link)
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      openMovieModal(movie);
    });

    // Formats HTML (Clean time only, no orange dots, no crowded subtexts)
    const formatsHtml = movie.formats.map(fmt => {
      const timeButtons = fmt.times.map(t => {
        if (t.isStarted) {
          // Started <= 15 min ago (Less prominent dashed style, clean time only, no "En sala" text)
          const startedText = t.diffMinutes <= 1 ? 'hace 1 minuto' : `hace ${t.diffMinutes} minutos`;
          return `
            <a href="${movie.buyUrl}" target="_blank" rel="noopener noreferrer" 
               class="showtime-btn is-started"
               onclick="event.stopPropagation();"
               title="Función iniciada recientemente (${startedText})">
              ${t.time}
            </a>
          `;
        }

        return `
          <a href="${movie.buyUrl}" target="_blank" rel="noopener noreferrer" 
             class="showtime-btn"
             onclick="event.stopPropagation();"
             title="Comprar entrada para las ${t.time} en Showcase">
            ${t.time}
          </a>
        `;
      }).join('');

      return `
        <div class="format-block">
          <div class="format-label">
            <span class="format-tag">${fmt.format}</span>
          </div>
          <div class="times-row">
            ${timeButtons}
          </div>
        </div>
      `;
    }).join('');

    card.innerHTML = `
      <!-- Uncropped Poster Column (Centered vertically) -->
      <div class="poster-column">
        <img src="${movie.poster}" 
             alt="${movie.title}" 
             width="270"
             height="386"
             loading="lazy"
             onerror="this.onerror=null; this.src='/icon.svg';">
      </div>

      <!-- Details Column (Natural vertical stacking, no artificial middle gaps) -->
      <div class="details-column">
        <header class="card-header">
          <h2 class="movie-title">
            <button type="button" class="movie-title-btn">
              ${movie.title}
            </button>
          </h2>
          <div class="meta-chips-row">
            ${movie.genre ? `<span class="meta-chip">${movie.genre}</span>` : ''}
          </div>
        </header>

        <div class="formats-container">
          ${formatsHtml}
        </div>

        <div class="card-footer-action">
          <button type="button" class="btn-open-detail">
            ${ICONS.info} Detalles
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * Movie Detail Modal / Sheet (Holds duration, rating, director, synopsis, trailer, and showtimes)
 */
function openMovieModal(movie) {
  const modal = document.getElementById('movieModal');
  const modalBody = document.getElementById('modalBody');
  if (!modal || !modalBody) return;

  state.modalSelectedTime = null;
  state.modalSelectedFormat = null;

  const formatsHtml = movie.formats.map(fmt => {
    const buttons = fmt.times.map(t => {
      const timeVal = typeof t === 'string' ? t : t.time;
      return `
        <button type="button" 
           class="showtime-btn modal-showtime-btn"
           data-time="${timeVal}"
           data-format="${escapeHtml(fmt.format)}"
           onclick="toggleModalShowtime(this, '${timeVal}', '${escapeHtml(fmt.format)}')"
           title="Seleccionar horario ${timeVal} (${formatFormatName(fmt.format)})">
          ${timeVal}
        </button>
      `;
    }).join('');

    return `
      <div class="format-block">
        <div class="format-label">
          <span class="format-tag">${fmt.format}</span>
        </div>
        <div class="times-row">
          ${buttons}
        </div>
      </div>
    `;
  }).join('');

  modalBody.innerHTML = `
    <div class="modal-hero">
      <div class="modal-poster">
        <img src="${movie.poster}" alt="${movie.title}" width="270" height="386" onerror="this.onerror=null; this.src='/icon.svg';">
      </div>
      <div class="modal-info">
        <h2 id="modalMovieTitle" class="modal-title">${movie.title}</h2>
        <div class="meta-chips-row">
          ${movie.genre ? `<span class="meta-chip">${movie.genre}</span>` : ''}
          ${movie.duration ? `<span class="meta-chip mono">${formatDuration(movie.duration)}</span>` : ''}
          ${movie.rating ? `<span class="meta-chip mono">${movie.rating}</span>` : ''}
        </div>
      </div>
    </div>

    <!-- Director (Aligned left, directly above synopsis) -->
    ${movie.director ? `
      <div class="modal-section-block">
        <span class="modal-section-label">Director</span>
        <p class="modal-director-text">${escapeHtml(movie.director)}</p>
      </div>
    ` : ''}

    <!-- Elenco (Aligned left, directly above synopsis) -->
    ${movie.cast ? `
      <div class="modal-section-block">
        <span class="modal-section-label">Elenco</span>
        <p class="modal-director-text">${escapeHtml(movie.cast)}</p>
      </div>
    ` : ''}

    <!-- Synopsis -->
    ${movie.synopsis ? `
      <div class="modal-section-block">
        <span class="modal-section-label">Sinopsis</span>
        <p class="modal-synopsis">${escapeHtml(movie.synopsis)}</p>
      </div>
    ` : ''}

    <!-- Official Trailer Embed -->
    <div class="modal-section-block">
      <span class="modal-section-label">Trailer oficial</span>
      ${movie.trailerYoutubeId ? `
        <div class="trailer-container">
          <iframe 
            src="https://www.youtube-nocookie.com/embed/${movie.trailerYoutubeId}?rel=0" 
            title="Trailer oficial de ${escapeHtml(movie.title)}" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen 
            loading="lazy">
          </iframe>
        </div>
      ` : `
        <a href="https://www.youtube.com/results?search_query=trailer+oficial+${encodeURIComponent(movie.title)}" 
           target="_blank" 
           rel="noopener noreferrer" 
           class="btn-trailer-search">
          ${ICONS.play} Buscar trailer en YouTube
        </a>
      `}
    </div>

    <!-- Formats & Showtimes -->
    <div class="modal-section-block">
      <span class="modal-section-label">Horarios en ${escapeHtml(state.currentData ? state.currentData.cinema : 'Showcase')}</span>
      <div class="formats-container">
        ${formatsHtml}
      </div>
    </div>

    <div class="modal-buy-section">
      <a href="${movie.buyUrl}" target="_blank" rel="noopener noreferrer" class="btn-primary">
        ${ICONS.ticket} Comprar entradas en Showcase Oficial
      </a>
      <button type="button" class="btn-whatsapp" onclick="shareMovieInvitation('${movie.id}')">
        ${ICONS.whatsapp} Compartir invitación por WhatsApp
      </button>
    </div>
  `;

  modal.removeAttribute('hidden');
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';

  // Always reset scroll position to 0 after rendering content
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.scrollTop = 0;
    requestAnimationFrame(() => {
      modalContent.scrollTop = 0;
    });
  }
}

/**
 * Toggles selection of a specific showtime inside the detail modal
 * Tap once -> paints with white background (selected)
 * Tap again -> immediately removes white background (deselected)
 */
function toggleModalShowtime(btn, timeVal, formatName) {
  const isAlreadySelected = btn.classList.contains('is-selected');
  const allBtns = document.querySelectorAll('.modal-showtime-btn');
  allBtns.forEach(b => {
    b.classList.remove('is-selected');
    b.blur();
  });

  if (!isAlreadySelected) {
    btn.classList.add('is-selected');
    state.modalSelectedTime = timeVal;
    state.modalSelectedFormat = formatName;
  } else {
    state.modalSelectedTime = null;
    state.modalSelectedFormat = null;
  }
  btn.blur();
}
window.toggleModalShowtime = toggleModalShowtime;

function closeMovieModal() {
  const modal = document.getElementById('movieModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('hidden', '');
  document.body.style.overflow = '';
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.scrollTop = 0;
  }
}

/**
 * Shares movie invitation via WhatsApp with date, showtimes separated by format, and synopsis
 */
function shareMovieInvitation(movieId) {
  if (!state.currentData || !state.currentData.movies) return;
  const movie = state.currentData.movies.find(m => String(m.id) === String(movieId));
  if (!movie) return;

  const invitationDate = formatInvitationDate(state.selectedDate);

  const lines = [
    `🎬 *¡Vamos a ver "${movie.title}" al cine!*`,
    ``,
    `📅 *Día:* ${invitationDate}`
  ];

  if (state.modalSelectedTime) {
    const fmtLabel = state.modalSelectedFormat ? ` (${formatFormatName(state.modalSelectedFormat)})` : '';
    lines.push(`⏰ *Función:* ${state.modalSelectedTime} hs${fmtLabel}`);
  } else {
    // Group all available showtimes separated by format
    const formatBlocks = [];
    if (movie.formats && movie.formats.length > 0) {
      for (const fmt of movie.formats) {
        const timesList = (fmt.times || [])
          .map(t => typeof t === 'string' ? t : t.time)
          .filter(Boolean);

        if (timesList.length > 0) {
          const cleanFmt = formatFormatName(fmt.format);
          formatBlocks.push(`• ${cleanFmt}: ${timesList.join(', ')} hs`);
        }
      }
    }

    if (formatBlocks.length > 0) {
      lines.push(`⏰ *Horarios disponibles:*`);
      lines.push(...formatBlocks);
    } else {
      lines.push(`⏰ *Horarios:* Consultar en cartelera`);
    }
  }

  const cinemaPlace = (state.currentData && state.currentData.cinema)
    ? `${state.currentData.cinema} (${state.currentData.address || ''})`
    : 'Showcase Cinemas';
  lines.push(`📍 *Lugar:* ${cinemaPlace}`);
  lines.push(``);

  if (movie.synopsis) {
    lines.push(`📝 *Sinopsis:*`);
    lines.push(movie.synopsis);
  }

  const shareText = lines.join('\n');
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`;
  window.open(url, '_blank');
}
window.shareMovieInvitation = shareMovieInvitation;

/**
 * Updates stats banner with distinct messaging depending on state
 */
function updateStats(moviesCount, functionsCount) {
  const countEl = document.getElementById('resultsCount');
  if (!countEl) return;

  // Active search query
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim();
    if (moviesCount === 0) {
      countEl.textContent = `No se encontraron películas para "${q}"`;
      return;
    }
    const movieWord = moviesCount === 1 ? 'película' : 'películas';
    const funcWord = functionsCount === 1 ? 'función' : 'funciones';
    countEl.textContent = `${moviesCount} ${movieWord} para "${q}" • ${functionsCount} ${funcWord}`;
    return;
  }

  // Empty results (filters or no functions left)
  if (moviesCount === 0) {
    const filterDesc = getFilterDescription();
    const isToday = Boolean(state.currentData && state.currentData.isToday);
    if (filterDesc) {
      countEl.textContent = 'No hay funciones para el filtro seleccionado';
    } else if (isToday) {
      countEl.textContent = 'Ya no quedan funciones disponibles por hoy';
    } else {
      countEl.textContent = 'Sin funciones programadas para esta fecha';
    }
    return;
  }

  // Normal billboard results with filter indicators
  const movieWord = moviesCount === 1 ? 'película' : 'películas';
  const funcWord = functionsCount === 1 ? 'función' : 'funciones';
  const filterDesc = getFilterDescription();
  const filterNote = filterDesc ? ` (${filterDesc})` : '';

  countEl.textContent = `${moviesCount} ${movieWord} • ${functionsCount} ${funcWord} disponibles${filterNote}`;
}

function resetSearch() {
  state.searchQuery = '';
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
    searchInput.focus();
  }
  renderBillboard();
}

const CINEMAS_FALLBACK = [
  { id: 14, slug: 'belgrano', name: 'Showcase Belgrano', shortName: 'Belgrano', location: 'Belgrano, CABA' },
  { id: 13, slug: 'norcenter', name: 'Showcase Norcenter', shortName: 'Norcenter', location: 'Vicente López, GBA' },
  { id: 18, slug: 'imax', name: 'IMAX Theatre (Norcenter)', shortName: 'IMAX Norcenter', location: 'Vicente López, GBA' },
  { id: 11, slug: 'haedo', name: 'Showcase Haedo', shortName: 'Haedo', location: 'Haedo, GBA Oeste' },
  { id: 15, slug: 'quilmes', name: 'Showcase Quilmes', shortName: 'Quilmes', location: 'Quilmes, GBA Sur' },
  { id: 12, slug: 'cordoba', name: 'Showcase Córdoba (Villa Cabrera)', shortName: 'Córdoba (Villa Cabrera)', location: 'Córdoba Capital' },
  { id: 17, slug: 'villa-allende', name: 'Showcase Villa Allende', shortName: 'Villa Allende (Córdoba)', location: 'Villa Allende, Córdoba' },
  { id: 16, slug: 'rosario', name: 'Showcase Rosario', shortName: 'Rosario', location: 'Rosario, Santa Fe' }
];

function renderCinemaDropdown() {
  const menu = document.getElementById('menuCinema');
  const label = document.getElementById('currentCinemaName');
  if (!menu) return;

  const cinemas = (state.availableCinemas && state.availableCinemas.length > 0)
    ? state.availableCinemas
    : CINEMAS_FALLBACK;

  const current = cinemas.find(c => String(c.id) === String(state.selectedCinema)) || cinemas[0];
  if (label) {
    label.textContent = current.shortName || current.name;
  }

  menu.innerHTML = cinemas.map(c => {
    const isSelected = String(c.id) === String(state.selectedCinema);
    return `
      <button type="button" 
              class="cinema-menu-item ${isSelected ? 'is-selected' : ''}" 
              data-cinema-id="${c.id}" 
              role="menuitem">
        <div class="cinema-item-info">
          <span class="cinema-item-name">${escapeHtml(c.name)}</span>
          <span class="cinema-item-location">${escapeHtml(c.location || '')}</span>
        </div>
        <span class="cinema-menu-check">${isSelected ? '✓' : ''}</span>
      </button>
    `;
  }).join('');

  // Item click handlers
  menu.querySelectorAll('.cinema-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const cinemaId = item.dataset.cinemaId;
      if (cinemaId && cinemaId !== state.selectedCinema) {
        selectCinema(cinemaId);
      } else {
        closeAllDropdowns();
      }
    });
  });
}

function selectCinema(cinemaId) {
  state.selectedCinema = String(cinemaId);
  try {
    localStorage.setItem('cartelera_cinema', state.selectedCinema);
  } catch (e) {
    // Ignore localStorage errors
  }
  closeAllDropdowns();
  renderCinemaDropdown();
  fetchCartelera(false);
}

function updateFooterAndHeader(data) {
  if (!data) return;
  const footerName = document.getElementById('footerCinemaName');
  const footerAddress = document.getElementById('footerCinemaAddress');
  const footerMaps = document.getElementById('footerMapsLink');
  const currentCinemaLabel = document.getElementById('currentCinemaName');

  if (footerName && data.cinema) {
    footerName.textContent = data.cinema;
  }
  if (footerAddress && data.address) {
    footerAddress.textContent = `${data.address} • Horarios oficiales`;
  }
  if (footerMaps && data.mapsUrl) {
    footerMaps.href = data.mapsUrl;
  }
  if (currentCinemaLabel && (data.cinemaShortName || data.cinema)) {
    currentCinemaLabel.textContent = data.cinemaShortName || data.cinema;
  }
}

/**
 * Dropdown Pills Logic (Option 2)
 */
function closeAllDropdowns() {
  document.querySelectorAll('.filter-dropdown-wrapper.is-open, .cinema-selector-wrapper.is-open').forEach(wrapper => {
    wrapper.classList.remove('is-open');
    const btn = wrapper.querySelector('.filter-pill-btn, .cinema-selector-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
}

function updateDropdownUI() {
  // 1. Language pill
  const langLabel = document.getElementById('pillLangLabel');
  const langBtn = document.getElementById('pillLangBtn');
  if (langLabel && langBtn) {
    if (state.filters.language === 'sub') {
      langLabel.textContent = 'Idioma: Subtitulada';
      langBtn.classList.add('is-active');
    } else if (state.filters.language === 'dob') {
      langLabel.textContent = 'Idioma: Doblada';
      langBtn.classList.add('is-active');
    } else {
      langLabel.textContent = 'Idioma: Todos';
      langBtn.classList.remove('is-active');
    }
  }

  // 2. Time pill
  const timeLabel = document.getElementById('pillTimeLabel');
  const timeBtn = document.getElementById('pillTimeBtn');
  if (timeLabel && timeBtn) {
    if (state.filters.timeBand === '15') {
      timeLabel.textContent = 'Horario: Desde 15:00';
      timeBtn.classList.add('is-active');
    } else if (state.filters.timeBand === '18') {
      timeLabel.textContent = 'Horario: Desde 18:00';
      timeBtn.classList.add('is-active');
    } else if (state.filters.timeBand === '20') {
      timeLabel.textContent = 'Horario: Desde 20:00';
      timeBtn.classList.add('is-active');
    } else if (state.filters.timeBand === '22') {
      timeLabel.textContent = 'Horario: Desde 22:00';
      timeBtn.classList.add('is-active');
    } else {
      timeLabel.textContent = 'Horario: Cualquier hora';
      timeBtn.classList.remove('is-active');
    }
  }

  // 3. Format pill
  const formatLabel = document.getElementById('pillFormatLabel');
  const formatBtn = document.getElementById('pillFormatBtn');
  if (formatLabel && formatBtn) {
    if (state.filters.format === '2d') {
      formatLabel.textContent = 'Formato: Solo 2D';
      formatBtn.classList.add('is-active');
    } else if (state.filters.format === '3d') {
      formatLabel.textContent = 'Formato: Solo 3D';
      formatBtn.classList.add('is-active');
    } else {
      formatLabel.textContent = 'Formato: 2D y 3D';
      formatBtn.classList.remove('is-active');
    }
  }

  // 4. Update checkmarks inside menus
  document.querySelectorAll('.filter-menu-item').forEach(item => {
    const filterKey = item.dataset.filter;
    const filterVal = item.dataset.val;
    const isSelected = state.filters[filterKey] === filterVal;
    item.classList.toggle('is-selected', isSelected);
    const checkEl = item.querySelector('.filter-menu-check');
    if (checkEl) {
      checkEl.textContent = isSelected ? '✓' : '';
    }
  });

  // 5. Clear filters button visibility
  const hasActiveFilters = state.filters.language !== 'all' || 
                           state.filters.timeBand !== 'all' || 
                           state.filters.format !== 'all';
  const clearBtn = document.getElementById('clearAllFiltersBtn');
  if (clearBtn) {
    clearBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
  }
}

function resetAllFilters() {
  state.filters.language = 'all';
  state.filters.timeBand = 'all';
  state.filters.format = 'all';
  state.searchQuery = '';

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';

  closeAllDropdowns();
  updateDropdownUI();
  renderBillboard();
}

/**
 * Event Listeners & Setup
 */
function setupEventListeners() {
  // Search input with debounce and typing feedback
  const searchInput = document.getElementById('searchInput');
  const searchClearBtn = document.getElementById('searchClearBtn');
  let searchDebounceTimer = null;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      state.searchQuery = val;

      const countEl = document.getElementById('resultsCount');
      if (val.trim() && countEl) {
        countEl.textContent = `Buscando "${val.trim()}"...`;
      }

      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        renderBillboard();
      }, 120);
    });

    // Keyboard shortcut: '/' to focus search, 'Escape' to clear or close modal
    window.addEventListener('keydown', (e) => {
      const modal = document.getElementById('movieModal');
      const isModalOpen = modal && !modal.hasAttribute('hidden') && modal.classList.contains('is-open');

      if (e.key === 'Escape') {
        closeAllDropdowns();
        if (isModalOpen) {
          closeMovieModal();
          return;
        }
        if (document.activeElement === searchInput) {
          resetSearch();
          searchInput.blur();
        }
      } else if (e.key === '/' && document.activeElement !== searchInput && !isModalOpen) {
        e.preventDefault();
        searchInput.focus();
      }
    });
  }

  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      resetSearch();
    });
  }

  // Filter Dropdown Pill Buttons (toggle open/close)
  document.querySelectorAll('.filter-pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrapper = btn.closest('.filter-dropdown-wrapper');
      const wasOpen = wrapper.classList.contains('is-open');
      closeAllDropdowns();
      if (!wasOpen) {
        wrapper.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Filter Menu Options Selection
  document.querySelectorAll('.filter-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const filterKey = item.dataset.filter;
      const filterVal = item.dataset.val;
      if (filterKey && filterVal) {
        state.filters[filterKey] = filterVal;
        closeAllDropdowns();
        updateDropdownUI();
        renderBillboard();
      }
    });
  });

  // Clear all filters button
  const clearFiltersBtn = document.getElementById('clearAllFiltersBtn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      resetAllFilters();
    });
  }

  // Cinema Selector Dropdown button
  const cinemaBtn = document.getElementById('cinemaSelectorBtn');
  if (cinemaBtn) {
    cinemaBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const wrapper = document.getElementById('dropdownCinemaWrapper');
      if (!wrapper) return;
      const wasOpen = wrapper.classList.contains('is-open');
      closeAllDropdowns();
      if (!wasOpen) {
        wrapper.classList.add('is-open');
        cinemaBtn.setAttribute('aria-expanded', 'true');
      }
    });
  }

  // Close dropdowns on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.filter-dropdown-wrapper') && !e.target.closest('.cinema-selector-wrapper')) {
      closeAllDropdowns();
    }
  });

  // Modal close button and backdrop click
  const modal = document.getElementById('movieModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeMovieModal);
  }
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeMovieModal();
      }
    });
  }
}

// Initial bootstrap
document.addEventListener('DOMContentLoaded', () => {
  renderCinemaDropdown();
  initDateTabs();
  setupEventListeners();
  fetchCartelera(false);
});
