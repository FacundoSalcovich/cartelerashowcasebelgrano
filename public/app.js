/**
 * Cartelera Showcase - Frontend Client
 * Pure modern vanilla JS, Zero external runtime libraries
 */

// Application State
const state = {
  selectedDate: null,
  lastActiveDate: null, // Remembers last active day when toggling to/from catalog mode
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
  modalSelectedTime: null,      // Specific showtime selected inside modal for WhatsApp sharing & direct buy
  modalSelectedFormat: null,    // Format of the selected showtime (e.g. 2D Subtitulado)
  modalSelectedDate: null,      // Date ISO of selected showtime (e.g. 2026-11-09)
  modalActiveTab: 'day',        // 'day' | 'week'
  modalDefaultBuyUrl: null,     // Default general buy URL for the currently open movie
  activeModalMovieId: null,     // Movie ID currently open in detail modal
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
 * Formats an ISO date into compact chip label and full header label
 */
function formatScheduleDate(isoDate) {
  if (!isoDate) return { chipLabel: '', headerLabel: '', badge: '' };
  const now = new Date();
  const arDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(now);

  const [tY, tM, tD] = arDateStr.split('-').map(Number);
  const [sY, sM, sD] = isoDate.split('-').map(Number);

  const todayUtc = Date.UTC(tY, tM - 1, tD);
  const selUtc = Date.UTC(sY, sM - 1, sD);
  const diffDays = Math.round((selUtc - todayUtc) / (1000 * 60 * 60 * 24));

  const targetDate = new Date(Date.UTC(sY, sM - 1, sD, 12, 0, 0));
  const weekdayShort = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' }).format(targetDate);
  const weekdayLong = new Intl.DateTimeFormat('es-AR', { weekday: 'long', timeZone: 'UTC' }).format(targetDate);
  const monthShort = new Intl.DateTimeFormat('es-AR', { month: 'short', timeZone: 'UTC' }).format(targetDate);

  const cleanWeekdayLong = weekdayLong.charAt(0).toUpperCase() + weekdayLong.slice(1);
  const cleanWeekdayShort = weekdayShort.charAt(0).toUpperCase() + weekdayShort.slice(1).replace('.', '');

  let badge = '';
  if (diffDays === 0) badge = 'Hoy';
  else if (diffDays === 1) badge = 'Mañana';

  return {
    isoDate,
    diffDays,
    badge,
    chipLabel: `${cleanWeekdayShort} ${sD}/${sM}`,
    headerLabel: `${cleanWeekdayLong} ${sD} de ${monthShort}`
  };
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
 * Generates semantic format tag without heavy background boxes
 */
function getFormatTagHtml(formatStr) {
  const upper = (formatStr || '').toUpperCase();
  const subClass = upper.includes('SUB') ? 'format-tag-sub' : upper.includes('DOB') ? 'format-tag-dob' : '';
  return `<span class="format-tag ${subClass}">${formatStr}</span>`;
}

/**
 * Detects if a movie poster has baked-in white letterbox bars (e.g. Los juegos del hambre from VoyAlCine)
 * and applies .has-white-bars to zoom the poster artwork cleanly to 100% of the container.
 */
function detectPosterLetterbox(img) {
  try {
    if (!img || !img.complete || img.naturalWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    
    // Sample top edge and bottom edge
    ctx.drawImage(img, img.naturalWidth / 2, 2, 1, 1, 0, 0, 1, 1);
    const topPixel = ctx.getImageData(0, 0, 1, 1).data;
    ctx.drawImage(img, img.naturalWidth / 2, img.naturalHeight - 2, 1, 1, 0, 0, 1, 1);
    const bottomPixel = ctx.getImageData(0, 0, 1, 1).data;

    const isTopWhite = topPixel[0] > 235 && topPixel[1] > 235 && topPixel[2] > 235;
    const isBottomWhite = bottomPixel[0] > 235 && bottomPixel[1] > 235 && bottomPixel[2] > 235;

    if (isTopWhite || isBottomWhite) {
      img.classList.add('has-white-bars');
    }
  } catch (e) {
    // If canvas is tainted or error, fallback gracefully
  }
}

/**
 * Renders date tabs dynamically based on publishedDates from Showcase
 * Eliminates empty days and adds 'Toda la semana'
 */
function renderDateTabs(publishedDates) {
  const container = document.getElementById('dateTabs');
  if (!container) return;

  const now = new Date();
  const arDateFormatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/Argentina/Buenos_Aires', 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  });
  const todayArStr = arDateFormatter.format(now); // "YYYY-MM-DD"
  const [tY, tM, tD] = todayArStr.split('-').map(Number);
  const todayUtc = Date.UTC(tY, tM - 1, tD);

  // If no publishedDates passed yet (initial load), default to today
  const rawList = Array.isArray(publishedDates) && publishedDates.length > 0
    ? publishedDates
    : [todayArStr];

  // Only keep dates today or in the future
  const validDates = rawList.filter(iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d) >= todayUtc;
  }).sort();

  if (!validDates.includes(todayArStr)) {
    validDates.unshift(todayArStr);
  }

  // Keep dates belonging to current cycle (<= 6 days ahead)
  const cycleDates = validDates.filter(iso => {
    const [y, m, d] = iso.split('-').map(Number);
    const diff = Math.round((Date.UTC(y, m - 1, d) - todayUtc) / (1000 * 60 * 60 * 24));
    return diff <= 6;
  });

  const dateOptions = cycleDates.map(isoDate => {
    const [sY, sM, sD] = isoDate.split('-').map(Number);
    const selUtc = Date.UTC(sY, sM - 1, sD);
    const diffDays = Math.round((selUtc - todayUtc) / (1000 * 60 * 60 * 24));

    let label = '';
    const sublabel = `${String(sD).padStart(2, '0')}/${String(sM).padStart(2, '0')}`;

    if (diffDays === 0) {
      label = 'Hoy';
    } else if (diffDays === 1) {
      label = 'Mañana';
    } else {
      const targetDateObj = new Date(Date.UTC(sY, sM - 1, sD, 12, 0, 0));
      const weekday = new Intl.DateTimeFormat('es-AR', { weekday: 'short', timeZone: 'UTC' }).format(targetDateObj);
      label = weekday.charAt(0).toUpperCase() + weekday.slice(1, 3).replace('.', '');
    }

    return { isoDate, label, sublabel };
  });

  if (!state.selectedDate) {
    state.selectedDate = todayArStr;
  }
  if (state.selectedDate !== 'all') {
    state.lastActiveDate = state.selectedDate;
  }

  container.innerHTML = '';
  dateOptions.forEach(opt => {
    const isActive = state.selectedDate === opt.isoDate;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `date-tab ${isActive ? 'is-active' : ''}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('tabindex', isActive ? '0' : '-1');
    btn.dataset.date = opt.isoDate;
    btn.innerHTML = `<span>${opt.label}</span><span class="date-sublabel">${opt.sublabel}</span>`;

    btn.addEventListener('click', () => {
      if (state.selectedDate === opt.isoDate && !state.isLoading) return;
      selectDate(opt.isoDate, btn);
    });

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

function initDateTabs() {
  renderDateTabs();
}

function selectDate(dateIso, clickedBtn) {
  state.selectedDate = dateIso;
  const isAll = Boolean(dateIso === 'all');
  if (!isAll) {
    state.lastActiveDate = dateIso;
  }

  // Synchronize View Mode Segmented Control
  const modeDateBtn = document.getElementById('modeDateBtn');
  const modeAllBtn = document.getElementById('modeAllBtn');
  const datesNavWrapper = document.getElementById('datesNavWrapper');

  if (modeDateBtn && modeAllBtn) {
    modeDateBtn.classList.toggle('is-active', !isAll);
    modeDateBtn.setAttribute('aria-selected', !isAll ? 'true' : 'false');
    modeAllBtn.classList.toggle('is-active', isAll);
    modeAllBtn.setAttribute('aria-selected', isAll ? 'true' : 'false');
  }

  if (datesNavWrapper) {
    datesNavWrapper.style.display = isAll ? 'none' : '';
  }

  // Hide filters immediately if switching to "Todas las películas" catalog view
  const filterRow = document.querySelector('.filter-pills-row');
  if (filterRow) {
    filterRow.style.display = isAll ? 'none' : 'flex';
  }
  
  const allTabs = document.querySelectorAll('.date-tab');
  allTabs.forEach(t => {
    t.classList.remove('is-active');
    t.setAttribute('aria-selected', 'false');
    t.setAttribute('tabindex', '-1');
  });

  if (!isAll) {
    if (!clickedBtn) {
      clickedBtn = document.querySelector(`.date-tab[data-date="${dateIso}"]`);
    }

    if (clickedBtn) {
      clickedBtn.classList.add('is-active');
      clickedBtn.setAttribute('aria-selected', 'true');
      clickedBtn.setAttribute('tabindex', '0');
      clickedBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  fetchCartelera(false);
}

function jumpToDate(dateIso) {
  closeMovieModal();
  selectDate(dateIso);
}
window.selectDate = selectDate;
window.jumpToDate = jumpToDate;

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
    if (state.currentData.publishedDates) {
      renderDateTabs(state.currentData.publishedDates);
    }
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
    if (data.publishedDates) {
      renderDateTabs(data.publishedDates);
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

  const isAllWeek = Boolean(state.selectedDate === 'all' || (state.currentData && state.currentData.isAllWeek));
  container.classList.toggle('is-catalog-grid', isAllWeek);

  const filterRow = document.querySelector('.filter-pills-row');
  if (filterRow) {
    filterRow.style.display = isAllWeek ? 'none' : 'flex';
  }

  if (isAllWeek) {
    container.innerHTML = Array.from({ length: 8 }).map(() => `
      <div class="skeleton-catalog-card" aria-hidden="true">
        <div class="skeleton-poster-catalog"></div>
        <div class="skeleton-line" style="width: 75%; height: 14px; margin-top: 2px;"></div>
      </div>
    `).join('');
  } else {
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
  }

  const countEl = document.getElementById('resultsCount');
  if (countEl) {
    countEl.textContent = isAllWeek 
      ? 'Cargando películas...'
      : 'Consultando cartelera oficial en vivo...';
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
  const isAllWeek = Boolean(state.currentData.isAllWeek || state.selectedDate === 'all');
  const currentLiveTime = getLiveArgentinaTime();
  const query = state.searchQuery.toLowerCase().trim();

  // Hide filter row when viewing "Todas las películas" catalog
  const filterRow = document.querySelector('.filter-pills-row');
  if (filterRow) {
    filterRow.style.display = isAllWeek ? 'none' : 'flex';
  }

  let totalAvailableFunctions = 0;
  const processedMovies = [];

  for (const movie of movies) {
    // Title filter
    if (query && !movie.title.toLowerCase().includes(query)) {
      continue;
    }

    const validFormats = [];
    const allValidUpcomingTimes = [];

    for (const fmt of (movie.formats || [])) {
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
      const rawTimes = (fmt.performances && fmt.performances.length > 0)
        ? fmt.performances
        : fmt.times;

      for (const item of (rawTimes || [])) {
        const timeStr = typeof item === 'string' ? item : item.time;
        const buyUrl = (typeof item === 'object' && item.buyUrl) ? item.buyUrl : movie.buyUrl;

        // Time band filter with 15-minute tolerance margin (e.g. 17:45+ is included in the 18:00 band)
        const showMinutes = timeStringToMinutes(timeStr);
        let minMinutes = 0;
        if (state.filters.timeBand === '15') minMinutes = 900;       // 15:00
        else if (state.filters.timeBand === '18') minMinutes = 1080; // 18:00
        else if (state.filters.timeBand === '20') minMinutes = 1200; // 20:00
        else if (state.filters.timeBand === '22') minMinutes = 1320; // 22:00

        if (minMinutes > 0 && showMinutes < (minMinutes - 15)) {
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
          buyUrl,
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

    if (validFormats.length > 0 || isAllWeek) {
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

  // Check for matching movies in other days of the week when searching
  const otherWeekMovies = state.currentData.otherWeekMovies || [];
  const processedOtherMovies = [];
  if (query) {
    for (const movie of otherWeekMovies) {
      if (movie.title.toLowerCase().includes(query)) {
        processedOtherMovies.push(movie);
      }
    }
    processedOtherMovies.sort((a, b) => a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
  }

  // Update statistics banner with clearly separated states
  updateStats(processedMovies.length, totalAvailableFunctions, processedOtherMovies.length, processedMovies);

  // Clear, contextual empty states
  if (processedMovies.length === 0) {
    if (query) {
      if (processedOtherMovies.length > 0) {
        container.innerHTML = `
          <div class="state-message" style="grid-column: 1 / -1; margin-bottom: 8px;">
            <div class="state-icon-box">
              ${ICONS.search}
            </div>
            <h3 class="state-title">"${escapeHtml(state.searchQuery.trim())}" no está disponible hoy</h3>
            <p class="state-desc">Pero encontramos ${processedOtherMovies.length === 1 ? 'esta película programada' : 'estas películas programadas'} en Showcase para los siguientes días:</p>
          </div>
        `;
        processedOtherMovies.forEach(movie => {
          container.appendChild(renderOtherWeekMovieCard(movie));
        });
        return;
      }

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

  // Set container layout mode (pure poster grid in catalog vs standard list in day view)
  container.classList.toggle('is-catalog-grid', isAllWeek);
  container.innerHTML = '';

  if (isAllWeek) {
    // Pure Poster Catalog View: only poster + overlay badge + title
    processedMovies.forEach((movie, idx) => {
      const isShowingToday = Boolean(movie.isScheduledToday);
      const imgPriorityAttr = idx < 4 ? 'fetchpriority="high"' : 'loading="lazy"';
      const card = document.createElement('article');
      card.className = 'movie-card-catalog';
      card.dataset.movieId = movie.id;
      card.innerHTML = `
        <div class="catalog-poster-wrapper">
          <img src="${movie.poster}" 
               alt="${movie.title}" 
               width="270" 
               height="386" 
               style="aspect-ratio: 270 / 386;"
               crossorigin="anonymous"
               onload="detectPosterLetterbox(this)"
               ${imgPriorityAttr}
               onerror="this.onerror=null; this.src='/icon.svg';">
          <span class="poster-badge ${isShowingToday ? 'is-cartelera' : 'is-anticipada'}">
            ${isShowingToday ? 'En cartelera' : 'Anticipada'}
          </span>
        </div>
        <div class="catalog-info-wrapper">
          <h3 class="catalog-movie-title">${movie.title}</h3>
        </div>
      `;

      card.addEventListener('click', () => {
        if (Date.now() - lastDropdownCloseTime < 350) return;
        const hasOpenDropdown = document.querySelector('.filter-dropdown-wrapper.is-open, .cinema-selector-wrapper.is-open');
        if (hasOpenDropdown) {
          closeAllDropdowns();
          return;
        }
        openMovieModal(movie);
      });

      container.appendChild(card);
    });

    syncOpenModalShowtimes(processedMovies);
    return;
  }

  // Render cards (Uncropped 2:3 poster centered vertically, natural spacing, clean times only)
  processedMovies.forEach((movie, idx) => {
    const card = document.createElement('article');
    card.className = 'movie-card';
    card.dataset.movieId = movie.id;

    // Click on card opens the Movie Detail Modal (unless clicking direct ticket purchase link or dismissing a dropdown)
    card.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      if (Date.now() - lastDropdownCloseTime < 350) return;
      const hasOpenDropdown = document.querySelector('.filter-dropdown-wrapper.is-open, .cinema-selector-wrapper.is-open');
      if (hasOpenDropdown) {
        closeAllDropdowns();
        return;
      }
      openMovieModal(movie);
    });

    // Formats HTML (Clean time only, no orange dots, no crowded subtexts)
    const formatsHtml = (movie.formats || []).map(fmt => {
      const timeButtons = fmt.times.map(t => {
        const timeVal = typeof t === 'string' ? t : t.time;
        const targetUrl = (typeof t === 'object' && t.buyUrl) ? t.buyUrl : movie.buyUrl;
        if (t.isStarted) {
          // Started <= 15 min ago (Non-clickable indicator, prevents attempting to purchase expired functions)
          const startedText = t.diffMinutes <= 1 ? 'hace 1 minuto' : `hace ${t.diffMinutes} minutos`;
          return `
            <span class="showtime-btn is-started"
               role="button"
               tabindex="-1"
               aria-disabled="true"
               onclick="event.stopPropagation();"
               title="Función ya iniciada (${startedText}) • Venta online cerrada en Showcase">
              ${timeVal}
            </span>
          `;
        }

        return `
          <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" 
             class="showtime-btn"
             onclick="event.stopPropagation();"
             title="Comprar entrada para las ${timeVal} en Showcase">
            ${timeVal}
          </a>
        `;
      }).join('');

      return `
        <div class="format-block">
          <div class="format-label">
            ${getFormatTagHtml(fmt.format)}
          </div>
          <div class="times-row">
            ${timeButtons}
          </div>
        </div>
      `;
    }).join('');

    const formatsOrChipsHtml = formatsHtml 
      ? `<div class="formats-container">${formatsHtml}</div>`
      : '<p class="modal-synopsis" style="color: var(--text-muted); font-size: 12px; margin: 6px 0;">Sin funciones disponibles para esta fecha.</p>';

    // LCP Priority: elevate loading for the first 2 above-the-fold images; lazy load the rest
    const imgPriorityAttr = idx < 2 ? 'fetchpriority="high"' : 'loading="lazy"';

    card.innerHTML = `
      <!-- Uncropped Poster Column (Centered vertically) -->
      <div class="poster-column">
        <img src="${movie.poster}" 
             alt="${movie.title}" 
             width="270"
             height="386"
             style="aspect-ratio: 270 / 386;"
             crossorigin="anonymous"
             onload="detectPosterLetterbox(this)"
             ${imgPriorityAttr}
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

        ${formatsOrChipsHtml}

        <div class="card-footer-action">
          <button type="button" class="btn-open-detail">
            ${ICONS.info} Detalles
          </button>
        </div>
      </div>
    `;

    container.appendChild(card);
  });

  // If there are also matching movies on other days of the week when searching, render section divider & cards
  if (query && processedOtherMovies.length > 0) {
    const divider = document.createElement('div');
    divider.className = 'week-search-divider';
    divider.innerHTML = `
      <div class="week-search-header">
        <span class="week-search-badge">Programadas para otras fechas</span>
        <span class="week-search-count">${processedOtherMovies.length} ${processedOtherMovies.length === 1 ? 'película' : 'películas'}</span>
      </div>
      <p class="week-search-subtitle">Películas en cartelera de Showcase que no se proyectan hoy pero tienen funciones programadas o venta anticipada:</p>
    `;
    container.appendChild(divider);

    processedOtherMovies.forEach(movie => {
      container.appendChild(renderOtherWeekMovieCard(movie));
    });
  }

  // Dynamically synchronize showtimes inside the open modal if viewing today
  syncOpenModalShowtimes(processedMovies);
}

/**
 * Renders a movie card specifically formatted for week search results with date chips
 */
function renderOtherWeekMovieCard(movie) {
  const card = document.createElement('article');
  card.className = 'movie-card movie-card-week';
  card.dataset.movieId = movie.id;

  card.addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return;
    if (Date.now() - lastDropdownCloseTime < 350) return;
    openMovieModal(movie);
  });

  const availableDates = Array.isArray(movie.availableDates) ? movie.availableDates : [];
  const chipsHtml = availableDates.map(d => {
    const dInfo = formatScheduleDate(d);
    return `
      <button type="button" 
         class="date-chip-btn" 
         onclick="event.stopPropagation(); jumpToDate('${d}');"
         title="Ver cartelera del ${dInfo.chipLabel}">
        ${dInfo.chipLabel}
      </button>
    `;
  }).join('');

  card.innerHTML = `
    <div class="poster-column">
      <img src="${movie.poster}" 
           alt="${movie.title}" 
           width="270"
           height="386"
           style="aspect-ratio: 270 / 386;"
           crossorigin="anonymous"
           onload="detectPosterLetterbox(this)"
           loading="lazy"
           onerror="this.onerror=null; this.src='/icon.svg';">
    </div>

    <div class="details-column">
      <header class="card-header">
        <h2 class="movie-title">
          <button type="button" class="movie-title-btn">
            ${movie.title}
          </button>
        </h2>
        <div class="meta-chips-row">
          ${movie.genre ? `<span class="meta-chip">${movie.genre}</span>` : ''}
          ${movie.duration ? `<span class="meta-chip mono">${formatDuration(movie.duration)}</span>` : ''}
          ${movie.rating ? `<span class="meta-chip mono">${movie.rating}</span>` : ''}
        </div>
      </header>

      <div class="week-movie-schedule-preview">
        <div class="week-movie-label">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>Fechas con funciones disponibles:</span>
        </div>
        <div class="date-chips-row">
          ${chipsHtml || '<span style="font-size: 11px; color: var(--text-tertiary);">Consultar horarios en detalle</span>'}
        </div>
      </div>

      <div class="card-footer-action">
        <button type="button" class="btn-open-detail">
          ${ICONS.info} Ver días y horarios
        </button>
      </div>
    </div>
  `;

  return card;
}

/**
 * Switches between day and full-week view inside the movie modal
 */
function switchModalTab(tabName) {
  state.modalActiveTab = tabName;
  const tabBtnDay = document.getElementById('tabBtnDay');
  const tabBtnWeek = document.getElementById('tabBtnWeek');
  const dayView = document.getElementById('modalDayView');
  const weekView = document.getElementById('modalWeekView');

  if (tabBtnDay && tabBtnWeek && dayView && weekView) {
    if (tabName === 'day') {
      tabBtnDay.classList.add('is-active');
      tabBtnDay.setAttribute('aria-selected', 'true');
      tabBtnWeek.classList.remove('is-active');
      tabBtnWeek.setAttribute('aria-selected', 'false');
      dayView.classList.remove('is-hidden');
      weekView.classList.add('is-hidden');
    } else {
      tabBtnDay.classList.remove('is-active');
      tabBtnDay.setAttribute('aria-selected', 'false');
      tabBtnWeek.classList.add('is-active');
      tabBtnWeek.setAttribute('aria-selected', 'true');
      dayView.classList.add('is-hidden');
      weekView.classList.remove('is-hidden');
    }
  }
}
window.switchModalTab = switchModalTab;

/**
 * Dynamically synchronizes showtimes in the open modal when time advances without page reload
 */
function syncOpenModalShowtimes(processedMovies) {
  const modal = document.getElementById('movieModal');
  if (!modal || !modal.open || !state.activeModalMovieId) return;

  const dayView = document.getElementById('modalDayView');
  if (!dayView || dayView.classList.contains('is-hidden')) return;

  const currentMovie = (processedMovies || []).find(m => String(m.id) === String(state.activeModalMovieId));
  const formatsContainer = dayView.querySelector('.formats-container');
  const buySection = modal.querySelector('.modal-buy-section');
  if (!formatsContainer) return;

  if (!currentMovie) {
    formatsContainer.innerHTML = '<p class="modal-synopsis" style="color: var(--text-muted); padding: 8px 0;">Todas las funciones de hoy para esta película ya finalizaron.</p>';
    if (buySection) {
      buySection.innerHTML = `
        <button type="button" id="modalBuyBtn" class="btn-primary is-disabled" disabled aria-disabled="true">
          ${ICONS.ticket} <span id="modalBuyBtnText">Venta online cerrada por hoy</span>
        </button>
        <button type="button" class="btn-whatsapp" onclick="shareMovieInvitation('${state.activeModalMovieId}')">
          ${ICONS.whatsapp} Compartir invitación por WhatsApp
        </button>
      `;
    }
    return;
  }

  const formatsHtml = currentMovie.formats.map(fmt => {
    const buttons = fmt.times.map(t => {
      const timeVal = typeof t === 'string' ? t : t.time;
      const targetUrl = (typeof t === 'object' && t.buyUrl) ? t.buyUrl : currentMovie.buyUrl;
      const isStarted = typeof t === 'object' ? Boolean(t.isStarted) : false;
      const diffMinutes = typeof t === 'object' ? (t.diffMinutes || 0) : 0;

      if (isStarted) {
        const startedText = diffMinutes <= 1 ? 'hace 1 minuto' : `hace ${diffMinutes} minutos`;
        return `
          <button type="button" 
             class="showtime-btn modal-showtime-btn is-started"
             disabled
             aria-disabled="true"
             title="Función ya iniciada (${startedText}) • Venta online cerrada en Showcase">
            ${timeVal}
          </button>
        `;
      }

      const isSelected = state.modalSelectedTime === timeVal && (!state.modalSelectedDate || state.modalSelectedDate === state.selectedDate);
      return `
        <button type="button" 
           class="showtime-btn modal-showtime-btn ${isSelected ? 'is-selected' : ''}"
           data-time="${timeVal}"
           data-format="${escapeHtml(fmt.format)}"
           data-buyurl="${escapeHtml(targetUrl)}"
           data-date="${state.selectedDate || ''}"
           onclick="toggleModalShowtime(this, '${timeVal}', '${escapeHtml(fmt.format)}', '${escapeHtml(targetUrl)}', '${state.selectedDate || ''}')"
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

  formatsContainer.innerHTML = formatsHtml;

  // Deselect time if it has started while user had it selected
  if (state.modalSelectedTime && (!state.modalSelectedDate || state.modalSelectedDate === state.selectedDate)) {
    const isNowStarted = currentMovie.formats.some(f =>
      f.times.some(t => typeof t === 'object' && t.time === state.modalSelectedTime && t.isStarted)
    );
    if (isNowStarted) {
      state.modalSelectedTime = null;
      state.modalSelectedFormat = null;
      state.modalSelectedDate = null;
    }
  }

  const hasUpcoming = currentMovie.formats.some(f => f.times.some(t => typeof t === 'string' || !t.isStarted));
  const buyBtn = document.getElementById('modalBuyBtn');
  const buyBtnText = document.getElementById('modalBuyBtnText');

  if (!hasUpcoming) {
    if (buySection && !state.modalSelectedTime) {
      buySection.innerHTML = `
        <button type="button" id="modalBuyBtn" class="btn-primary is-disabled" disabled aria-disabled="true">
          ${ICONS.ticket} <span id="modalBuyBtnText">Venta online cerrada por hoy</span>
        </button>
        <button type="button" class="btn-whatsapp" onclick="shareMovieInvitation('${currentMovie.id}')">
          ${ICONS.whatsapp} Compartir invitación por WhatsApp
        </button>
      `;
    }
  } else if (buyBtn && !state.modalSelectedTime) {
    buyBtn.href = '#';
    buyBtn.removeAttribute('target');
    buyBtn.removeAttribute('rel');
    buyBtn.classList.add('is-prompt');
    buyBtn.setAttribute('aria-disabled', 'true');
    if (buyBtnText) buyBtnText.textContent = 'Seleccioná un horario para comprar';
  }
}

/**
 * Movie Detail Modal / Sheet (Holds duration, rating, director, synopsis, trailer, and showtimes)
 */
function openMovieModal(movie) {
  const modal = document.getElementById('movieModal');
  const modalBody = document.getElementById('modalBody');
  if (!modal || !modalBody) return;

  state.activeModalMovieId = movie.id;
  state.modalSelectedTime = null;
  state.modalSelectedFormat = null;
  state.modalSelectedDate = null;
  state.modalDefaultBuyUrl = movie.buyUrl;

  const weeklySchedule = Array.isArray(movie.weeklySchedule) ? movie.weeklySchedule : [];
  const hasFormatsToday = Array.isArray(movie.formats) && movie.formats.length > 0;
  const isAllWeekView = Boolean(state.currentData && (state.currentData.isAllWeek || state.selectedDate === 'all'));
  const isWeekDefault = isAllWeekView || !movie.isScheduledToday || !hasFormatsToday;
  state.modalActiveTab = isWeekDefault ? 'week' : 'day';

  // 1. Day view HTML
  let dayFormatsHtml = '';
  if (hasFormatsToday) {
    dayFormatsHtml = movie.formats.map(fmt => {
      const buttons = fmt.times.map(t => {
        const timeVal = typeof t === 'string' ? t : t.time;
        const targetUrl = (typeof t === 'object' && t.buyUrl) ? t.buyUrl : movie.buyUrl;
        const isStarted = typeof t === 'object' ? Boolean(t.isStarted) : false;
        const diffMinutes = typeof t === 'object' ? (t.diffMinutes || 0) : 0;

        if (isStarted) {
          const startedText = diffMinutes <= 1 ? 'hace 1 minuto' : `hace ${diffMinutes} minutos`;
          return `
            <button type="button" 
               class="showtime-btn modal-showtime-btn is-started"
               disabled
               aria-disabled="true"
               title="Función ya iniciada (${startedText}) • Venta online cerrada en Showcase">
              ${timeVal}
            </button>
          `;
        }

        return `
          <button type="button" 
             class="showtime-btn modal-showtime-btn"
             data-time="${timeVal}"
             data-format="${escapeHtml(fmt.format)}"
             data-buyurl="${escapeHtml(targetUrl)}"
             data-date="${state.selectedDate || ''}"
             onclick="toggleModalShowtime(this, '${timeVal}', '${escapeHtml(fmt.format)}', '${escapeHtml(targetUrl)}', '${state.selectedDate || ''}')"
             title="Seleccionar horario ${timeVal} (${formatFormatName(fmt.format)})">
            ${timeVal}
          </button>
        `;
      }).join('');

      return `
        <div class="format-block">
          <div class="format-label">
            ${getFormatTagHtml(fmt.format)}
          </div>
          <div class="times-row">
            ${buttons}
          </div>
        </div>
      `;
    }).join('');
  } else {
    dayFormatsHtml = `
      <div class="modal-notice-banner">
        Esta película no está programada para hoy en este cine. Consultá las fechas disponibles en la pestaña <strong>"Todas las fechas"</strong>.
      </div>
    `;
  }

  // 2. Week view HTML (All available days and times)
  let weekHtml = '';
  if (weeklySchedule.length > 0) {
    const weekDaysHtml = weeklySchedule.map(day => {
      const dateInfo = formatScheduleDate(day.date);
      const isDayToday = (state.currentData && state.currentData.targetDate === day.date && state.currentData.isToday);
      const currentLiveTime = getLiveArgentinaTime();

      const dayFormatsHtml = (day.formats || []).map(fmt => {
        const timeButtons = (fmt.performances || fmt.times || []).map(p => {
          const timeVal = typeof p === 'string' ? p : p.time;
          const targetUrl = (typeof p === 'object' && p.buyUrl) ? p.buyUrl : movie.buyUrl;

          let isStarted = false;
          let diffMinutes = 0;
          if (isDayToday) {
            diffMinutes = getTimeDifferenceMinutes(timeVal, currentLiveTime);
            if (diffMinutes > 15) return '';
            isStarted = diffMinutes >= 0 && diffMinutes <= 15;
          }

          if (isStarted) {
            const startedText = diffMinutes <= 1 ? 'hace 1 minuto' : `hace ${diffMinutes} minutos`;
            return `
              <button type="button" 
                 class="showtime-btn modal-showtime-btn is-started"
                 disabled
                 aria-disabled="true"
                 title="Función ya iniciada (${startedText}) • Venta online cerrada">
                ${timeVal}
              </button>
            `;
          }

          return `
            <button type="button" 
               class="showtime-btn modal-showtime-btn"
               data-time="${timeVal}"
               data-date="${day.date}"
               data-format="${escapeHtml(fmt.format)}"
               data-buyurl="${escapeHtml(targetUrl)}"
               onclick="toggleModalShowtime(this, '${timeVal}', '${escapeHtml(fmt.format)}', '${escapeHtml(targetUrl)}', '${day.date}')"
               title="Seleccionar ${timeVal} (${formatFormatName(fmt.format)}) del ${dateInfo.chipLabel}">
              ${timeVal}
            </button>
          `;
        }).filter(Boolean).join('');

        if (!timeButtons) return '';

        return `
          <div class="format-block">
            <div class="format-label">
              ${getFormatTagHtml(fmt.format)}
            </div>
            <div class="times-row">
              ${timeButtons}
            </div>
          </div>
        `;
      }).filter(Boolean).join('');

      return `
        <div class="modal-week-day-block">
          <div class="modal-week-day-header">
            <div class="modal-week-day-title">
              ${dateInfo.badge ? `<span class="modal-week-day-badge">${dateInfo.badge}</span>` : ''}
              <span>${dateInfo.headerLabel}</span>
            </div>
            <button type="button" class="btn-jump-day" onclick="jumpToDate('${day.date}')" title="Ver toda la cartelera del ${dateInfo.chipLabel}">
              Ver día completo →
            </button>
          </div>
          <div class="formats-container">
            ${dayFormatsHtml || '<p class="modal-synopsis" style="color: var(--text-muted); font-size: 12px; margin: 4px 0;">Sin funciones disponibles para esta fecha.</p>'}
          </div>
        </div>
      `;
    }).join('');

    weekHtml = `
      <div class="modal-week-list">
        ${weekDaysHtml}
      </div>
    `;
  } else {
    weekHtml = '<p class="modal-synopsis" style="color: var(--text-muted); padding: 8px 0;">No hay funciones adicionales programadas en este momento.</p>';
  }

  const hasAnyUpcomingToday = hasFormatsToday && movie.formats.some(f => f.times.some(t => typeof t === 'string' || !t.isStarted));
  const hasAnyUpcomingWeek = weeklySchedule.length > 0;

  modalBody.innerHTML = `
    <div class="modal-hero">
      <div class="modal-poster">
        <img src="${movie.poster}" alt="${movie.title}" width="270" height="386" style="aspect-ratio: 270 / 386;" crossorigin="anonymous" onload="detectPosterLetterbox(this)" onerror="this.onerror=null; this.src='/icon.svg';">
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

    <!-- Formats & Showtimes (With Day / Week Tabs) -->
    <div class="modal-section-block">
      <div class="modal-schedule-header">
        <span class="modal-section-label">Horarios en ${escapeHtml(state.currentData ? state.currentData.cinema : 'Showcase')}</span>
        <div class="modal-schedule-tabs" role="tablist">
          <button type="button" 
             id="tabBtnDay" 
             class="modal-tab-btn ${isWeekDefault ? '' : 'is-active'}" 
             role="tab" 
             aria-selected="${isWeekDefault ? 'false' : 'true'}"
             onclick="switchModalTab('day')">
            ${state.currentData && state.currentData.isToday ? 'Hoy' : 'Este día'}
          </button>
          <button type="button" 
             id="tabBtnWeek" 
             class="modal-tab-btn ${isWeekDefault ? 'is-active' : ''}" 
             role="tab" 
             aria-selected="${isWeekDefault ? 'true' : 'false'}"
             onclick="switchModalTab('week')">
            Todas
          </button>
        </div>
      </div>

      <div id="modalDayView" class="modal-tab-content ${isWeekDefault ? 'is-hidden' : ''}">
        <div class="formats-container">
          ${dayFormatsHtml}
        </div>
      </div>

      <div id="modalWeekView" class="modal-tab-content ${isWeekDefault ? '' : 'is-hidden'}">
        ${weekHtml}
      </div>
    </div>

    <div class="modal-buy-section">
      ${hasAnyUpcomingToday || hasAnyUpcomingWeek
        ? `
          <a href="#" id="modalBuyBtn" class="btn-primary is-prompt" aria-disabled="true">
            ${ICONS.ticket} <span id="modalBuyBtnText">Seleccioná un horario para comprar</span>
          </a>
        `
        : `
          <button type="button" id="modalBuyBtn" class="btn-primary is-disabled" disabled aria-disabled="true">
            ${ICONS.ticket} <span id="modalBuyBtnText">Venta online cerrada por hoy</span>
          </button>
        `
      }
      <button type="button" class="btn-whatsapp" onclick="shareMovieInvitation('${movie.id}')">
        ${ICONS.whatsapp} Compartir invitación por WhatsApp
      </button>
    </div>
  `;

  // Guide prompt if clicked before selecting a showtime
  const modalBuyBtnEl = modal.querySelector('#modalBuyBtn');
  if (modalBuyBtnEl) {
    modalBuyBtnEl.addEventListener('click', (e) => {
      if (modalBuyBtnEl.classList.contains('is-prompt') || modalBuyBtnEl.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        const hintEl = modal.querySelector('.modal-schedule-tabs') || modal.querySelector('.formats-container') || modal.querySelector('.modal-week-list');
        if (hintEl) {
          hintEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          hintEl.classList.add('schedule-pulse-hint');
          setTimeout(() => hintEl.classList.remove('schedule-pulse-hint'), 800);
        }
      }
    });
  }

  // Inmovilize background page scroll
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  document.body.style.touchAction = 'none';

  if (typeof modal.showModal === 'function') {
    if (!modal.open) modal.showModal();
  } else {
    modal.removeAttribute('hidden');
    modal.classList.add('is-open');
  }

  // Ensure close button does not retain focus outline ring upon opening
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn) {
    modalCloseBtn.blur();
  }

  // Always reset scroll position to 0 after rendering content
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.focus({ preventScroll: true });
    modalContent.scrollTop = 0;
    requestAnimationFrame(() => {
      modalContent.scrollTop = 0;
    });
  }

  setupSheetGestures(modal);
}

/**
 * Swipe-down to dismiss gesture (Instagram / iOS native modal sheet feel)
 */
let isSheetGesturesBound = false;
function setupSheetGestures(modal) {
  if (isSheetGesturesBound) return;
  const content = modal.querySelector('.modal-content');
  if (!content) return;
  isSheetGesturesBound = true;

  let startY = 0;
  let startX = 0;
  let currentDeltaY = 0;
  let isDragging = false;

  content.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    currentDeltaY = 0;
    isDragging = false;
  }, { passive: true });

  content.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const touchY = e.touches[0].clientY;
    const touchX = e.touches[0].clientX;
    const diffY = touchY - startY;
    const diffX = touchX - startX;

    const isTargetHandle = Boolean(e.target.closest('.sheet-handle'));

    if (!isDragging) {
      // Must be moving downwards and dominantly vertical
      if (diffY > 8 && Math.abs(diffY) > Math.abs(diffX * 1.3)) {
        if (isTargetHandle || content.scrollTop <= 0) {
          isDragging = true;
          content.style.transition = 'none';
        }
      }
    }

    if (isDragging) {
      if (diffY > 0) {
        if (e.cancelable) e.preventDefault();
        currentDeltaY = diffY;
        content.style.transform = `translateY(${diffY}px)`;
      } else {
        currentDeltaY = 0;
        content.style.transform = '';
        isDragging = false;
      }
    }
  }, { passive: false });

  const finishDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    content.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';

    if (currentDeltaY > 80) {
      content.style.transform = 'translateY(100%)';
      setTimeout(() => {
        closeMovieModal();
      }, 200);
    } else {
      content.style.transform = 'translateY(0)';
      setTimeout(() => {
        content.style.transition = '';
      }, 220);
    }
  };

  content.addEventListener('touchend', finishDrag, { passive: true });
  content.addEventListener('touchcancel', finishDrag, { passive: true });
}

/**
 * Toggles selection of a specific showtime inside the detail modal
 * Tap once -> paints with white background (selected) & syncs direct buy link
 * Tap again -> immediately removes white background (deselected) & restores default buy link
 */
function toggleModalShowtime(btn, timeVal, formatName, buyUrl, dateIso) {
  const isAlreadySelected = btn.classList.contains('is-selected');
  const allBtns = document.querySelectorAll('.modal-showtime-btn');
  allBtns.forEach(b => {
    b.classList.remove('is-selected');
    b.blur();
  });

  const buyBtn = document.getElementById('modalBuyBtn');
  const buyBtnText = document.getElementById('modalBuyBtnText');

  if (!isAlreadySelected) {
    btn.classList.add('is-selected');
    state.modalSelectedTime = timeVal;
    state.modalSelectedFormat = formatName;
    state.modalSelectedDate = dateIso || state.selectedDate;

    const dateInfo = dateIso ? formatScheduleDate(dateIso) : null;
    const isTodayDate = Boolean(state.currentData && state.currentData.targetDate === dateIso && state.currentData.isToday);
    const dateSuffix = (dateInfo && !isTodayDate && dateInfo.chipLabel) ? ` • ${dateInfo.chipLabel}` : '';

    if (buyBtn) {
      if (buyUrl) buyBtn.href = buyUrl;
      buyBtn.target = '_blank';
      buyBtn.rel = 'noopener noreferrer';
      buyBtn.classList.remove('is-disabled', 'is-prompt');
      buyBtn.removeAttribute('disabled');
      buyBtn.removeAttribute('aria-disabled');
    }
    if (buyBtnText) {
      buyBtnText.textContent = `Comprar función ${timeVal} hs${dateSuffix}`;
    }
  } else {
    state.modalSelectedTime = null;
    state.modalSelectedFormat = null;
    state.modalSelectedDate = null;
    if (buyBtn) {
      buyBtn.href = '#';
      buyBtn.removeAttribute('target');
      buyBtn.removeAttribute('rel');
      buyBtn.classList.add('is-prompt');
      buyBtn.setAttribute('aria-disabled', 'true');
    }
    if (buyBtnText) {
      buyBtnText.textContent = 'Seleccioná un horario para comprar';
    }
  }
  btn.blur();
}
window.toggleModalShowtime = toggleModalShowtime;

function closeMovieModal() {
  const modal = document.getElementById('movieModal');
  if (!modal) return;

  state.activeModalMovieId = null;
  state.modalSelectedTime = null;
  state.modalSelectedFormat = null;
  state.modalSelectedDate = null;
  state.modalDefaultBuyUrl = null;

  // Restore background page scroll
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.body.style.touchAction = '';

  if (typeof modal.close === 'function' && modal.open) {
    modal.close();
  } else {
    modal.classList.remove('is-open');
    modal.setAttribute('hidden', '');
  }
  const modalContent = modal.querySelector('.modal-content');
  if (modalContent) {
    modalContent.scrollTop = 0;
    modalContent.style.transform = '';
    modalContent.style.transition = '';
  }
}

/**
 * Shares movie invitation via WhatsApp with date, showtimes separated by format, and synopsis
 */
function shareMovieInvitation(movieId) {
  if (!state.currentData) return;
  const allList = [
    ...(state.currentData.movies || []),
    ...(state.currentData.otherWeekMovies || []),
    ...(state.currentData.allWeekMovies || [])
  ];
  const movie = allList.find(m => String(m.id) === String(movieId));
  if (!movie) return;

  const targetDateIso = state.modalSelectedDate || state.selectedDate;
  const invitationDate = formatInvitationDate(targetDateIso);

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
    const formatsToUse = (movie.formats && movie.formats.length > 0)
      ? movie.formats
      : (movie.weeklySchedule && movie.weeklySchedule[0] ? movie.weeklySchedule[0].formats : []);

    if (formatsToUse && formatsToUse.length > 0) {
      for (const fmt of formatsToUse) {
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
function updateStats(moviesCount, functionsCount, otherCount = 0, processedMovies = []) {
  const countEl = document.getElementById('resultsCount');
  if (!countEl) return;

  // Active search query
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim();
    if (moviesCount === 0) {
      if (otherCount > 0) {
        const otherWord = otherCount === 1 ? 'película programada' : 'películas programadas';
        countEl.textContent = `${otherCount} ${otherWord} en otras fechas para "${q}"`;
      } else {
        countEl.textContent = `No se encontraron películas para "${q}"`;
      }
      return;
    }
    const movieWord = moviesCount === 1 ? 'película' : 'películas';
    const funcWord = functionsCount === 1 ? 'función' : 'funciones';
    if (otherCount > 0) {
      countEl.textContent = `${moviesCount} hoy + ${otherCount} en otros días para "${q}"`;
    } else {
      countEl.textContent = `${moviesCount} ${movieWord} para "${q}" • ${functionsCount} ${funcWord}`;
    }
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

  // All movies catalog results
  const isAllWeek = Boolean(state.currentData && (state.currentData.isAllWeek || state.selectedDate === 'all'));
  if (isAllWeek) {
    const movieWord = moviesCount === 1 ? 'película' : 'películas';
    const list = Array.isArray(processedMovies) ? processedMovies : [];
    const carteleraCount = list.filter(m => m.isScheduledToday).length;
    const anticipadasCount = list.filter(m => !m.isScheduledToday).length;

    let countDetail = '';
    if (carteleraCount > 0 && anticipadasCount > 0) {
      countDetail = `${moviesCount} ${movieWord} (${carteleraCount} en cartelera, ${anticipadasCount} ${anticipadasCount === 1 ? 'anticipada' : 'anticipadas'})`;
    } else if (anticipadasCount > 0) {
      countDetail = `${moviesCount} ${movieWord} anticipadas`;
    } else {
      countDetail = `${moviesCount} ${movieWord} en cartelera`;
    }

    countEl.textContent = `${countDetail} • Tocá una película para ver horarios`;
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
              data-cinema-id="${c.id}">
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
function showDropdownBackdrop() {
  const backdrop = document.getElementById('dropdownBackdrop');
  if (backdrop) {
    backdrop.removeAttribute('hidden');
  }
}

let lastDropdownCloseTime = 0;

function hideDropdownBackdrop() {
  const backdrop = document.getElementById('dropdownBackdrop');
  if (backdrop) {
    backdrop.setAttribute('hidden', '');
  }
}

function closeAllDropdowns() {
  const hasOpen = document.querySelector('.filter-dropdown-wrapper.is-open, .cinema-selector-wrapper.is-open');
  if (hasOpen) {
    lastDropdownCloseTime = Date.now();
  }
  document.querySelectorAll('.filter-dropdown-wrapper.is-open, .cinema-selector-wrapper.is-open').forEach(wrapper => {
    wrapper.classList.remove('is-open');
    const btn = wrapper.querySelector('.filter-pill-btn, .cinema-selector-btn');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  });
  hideDropdownBackdrop();
}

function updateDropdownUI() {
  // 1. Language pill
  const langLabel = document.getElementById('pillLangLabel');
  const langBtn = document.getElementById('pillLangBtn');
  if (langLabel && langBtn) {
    if (state.filters.language === 'sub') {
      langLabel.textContent = 'Sub';
      langBtn.classList.add('is-active');
    } else if (state.filters.language === 'dob') {
      langLabel.textContent = 'Doblada';
      langBtn.classList.add('is-active');
    } else {
      langLabel.textContent = 'Idioma';
      langBtn.classList.remove('is-active');
    }
  }

  // 2. Time pill
  const timeLabel = document.getElementById('pillTimeLabel');
  const timeBtn = document.getElementById('pillTimeBtn');
  if (timeLabel && timeBtn) {
    if (state.filters.timeBand === '15') {
      timeLabel.textContent = 'Desde 15h';
      timeBtn.classList.add('is-active');
    } else if (state.filters.timeBand === '18') {
      timeLabel.textContent = 'Desde 18h';
      timeBtn.classList.add('is-active');
    } else if (state.filters.timeBand === '20') {
      timeLabel.textContent = 'Desde 20h';
      timeBtn.classList.add('is-active');
    } else if (state.filters.timeBand === '22') {
      timeLabel.textContent = 'Desde 22h';
      timeBtn.classList.add('is-active');
    } else {
      timeLabel.textContent = 'Horario';
      timeBtn.classList.remove('is-active');
    }
  }

  // 3. Format pill
  const formatLabel = document.getElementById('pillFormatLabel');
  const formatBtn = document.getElementById('pillFormatBtn');
  if (formatLabel && formatBtn) {
    if (state.filters.format === '2d') {
      formatLabel.textContent = '2D';
      formatBtn.classList.add('is-active');
    } else if (state.filters.format === '3d') {
      formatLabel.textContent = '3D';
      formatBtn.classList.add('is-active');
    } else {
      formatLabel.textContent = 'Formato';
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
      const isModalOpen = modal && (modal.open || (!modal.hasAttribute('hidden') && modal.classList.contains('is-open')));

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
        showDropdownBackdrop();
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
        showDropdownBackdrop();
      }
    });
  }

  // View Mode Segmented Control (Por fecha vs. Todas las películas)
  const modeDateBtn = document.getElementById('modeDateBtn');
  const modeAllBtn = document.getElementById('modeAllBtn');

  if (modeDateBtn) {
    modeDateBtn.addEventListener('click', () => {
      if (state.selectedDate !== 'all') return;
      const firstTabDate = document.querySelector('.date-tab')?.dataset?.date;
      const targetDate = state.lastActiveDate || firstTabDate;
      selectDate(targetDate);
    });
  }

  if (modeAllBtn) {
    modeAllBtn.addEventListener('click', () => {
      if (state.selectedDate === 'all') return;
      selectDate('all');
    });
  }

  // Global capture interceptor: absorbs any click or touch outside an open dropdown before it can trigger cards or buttons
  const isTargetInsideDropdown = (target) => {
    return Boolean(
      target.closest('.cinema-menu') ||
      target.closest('.filter-menu') ||
      target.closest('.cinema-selector-btn') ||
      target.closest('.filter-pill-btn')
    );
  };

  window.addEventListener('click', (e) => {
    const hasOpenDropdown = document.querySelector('.filter-dropdown-wrapper.is-open, .cinema-selector-wrapper.is-open');
    if (hasOpenDropdown) {
      if (isTargetInsideDropdown(e.target)) return;
      // Click was outside open menu: kill the event and close menus
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeAllDropdowns();
      return;
    }

    // If a dropdown was dismissed within 350ms, block any delayed synthetic click
    if (Date.now() - lastDropdownCloseTime < 350) {
      if (!isTargetInsideDropdown(e.target)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    }
  }, true);

  window.addEventListener('touchend', (e) => {
    const hasOpenDropdown = document.querySelector('.filter-dropdown-wrapper.is-open, .cinema-selector-wrapper.is-open');
    if (hasOpenDropdown) {
      if (isTargetInsideDropdown(e.target)) return;
      // Touch was outside open menu: prevent synthetic click and close menus
      if (e.cancelable) e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeAllDropdowns();
    }
  }, true);

  // Close open dropdowns when scrolling the page
  window.addEventListener('scroll', () => {
    const hasOpenDropdown = document.querySelector('.filter-dropdown-wrapper.is-open, .cinema-selector-wrapper.is-open');
    if (hasOpenDropdown) {
      closeAllDropdowns();
    }
  }, { passive: true });

  // Modal close button and backdrop click
  const modal = document.getElementById('movieModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeMovieModal);
  }
  if (modal) {
    modal.addEventListener('close', () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    });
    // Backdrop click detection: clicks outside .modal-content dismiss the dialog
    modal.addEventListener('click', (e) => {
      const modalContent = modal.querySelector('.modal-content');
      if (!modalContent) {
        closeMovieModal();
        return;
      }
      const rect = modalContent.getBoundingClientRect();
      const isInside = (
        e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom
      );
      if (!isInside) {
        closeMovieModal();
      }
    });

    // Native Esc key handling on <dialog>
    modal.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeMovieModal();
    });
  }
}

let liveTickerInterval = null;

/**
 * Checks and recalculates started/expired showtimes live as time advances without full page refresh
 */
function checkLiveUpdates() {
  if (!state.currentData || state.isLoading) return;

  // Don't interrupt user if currently typing in search or holding an open dropdown menu
  if (document.activeElement === document.getElementById('searchInput')) return;
  if (document.querySelector('.filter-dropdown-wrapper.is-open, .cinema-selector-wrapper.is-open')) return;

  // Check if calendar day rolled over past midnight in Argentina
  const currentArDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const firstTabDate = document.querySelector('.date-tab')?.dataset?.date;
  if (firstTabDate && firstTabDate !== currentArDate) {
    initDateTabs();
    fetchCartelera(true);
    return;
  }

  // If viewing today's billboard, dynamically re-calculate started & expired functions in real time
  if (state.currentData.isToday) {
    renderBillboard();
  }
}

/**
 * Starts background real-time ticker that keeps showtimes updated every 15 seconds
 */
function startLiveTicker() {
  if (liveTickerInterval) clearInterval(liveTickerInterval);

  // Check every 15 seconds
  liveTickerInterval = setInterval(checkLiveUpdates, 15000);

  // Refresh immediately when user returns to the tab or window regains focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkLiveUpdates();
    }
  });

  window.addEventListener('focus', () => {
    checkLiveUpdates();
  });
}

// Initial bootstrap
document.addEventListener('DOMContentLoaded', () => {
  renderCinemaDropdown();
  initDateTabs();
  setupEventListeners();
  fetchCartelera(false);
  startLiveTicker();
});

// Native Dev Live-Reload & Hot CSS Swap (Localhost only)
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  try {
    const devEs = new EventSource('/api/dev-reload');
    devEs.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'reload') {
          window.location.reload();
        } else if (payload.type === 'css') {
          const links = document.querySelectorAll('link[rel="stylesheet"]');
          links.forEach(link => {
            const url = new URL(link.href, window.location.href);
            url.searchParams.set('t', Date.now());
            link.href = url.toString();
          });
        }
      } catch (err) {}
    };
  } catch (e) {}
}
