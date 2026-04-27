/* ============================================
   CatDrop — index.js
   Cat API: https://thecatapi.com/
   ============================================ */

// --- API Config ---
const CAT_API_URL = 'https://api.thecatapi.com/v1/images/search';

// --- App State ---
let currentCat = null;          // { id, url } of the cat currently on screen
let viewedCats = [];            // Array of all cats shown this session (no duplicates)
let favorites = [];             // Array of favorited cats (persisted to localStorage)
let viewedCount = 0;            // Total cats viewed
let streak = 0;                 // Like-streak counter
let currentPage = 'home';       // Active page

// --- Lifecycle: Init ---
document.addEventListener('DOMContentLoaded', () => {
  loadFavoritesFromStorage();
  fetchCat();
});

// ===========================
// DATA FETCHING
// ===========================

/**
 * Fetch a new random cat from The Cat API.
 * Prevents duplicate cats within the session.
 * Falls back to error state on network failure.
 */
async function fetchCat() {
  showSpinner();
  hideActionButtons();

  try {
    let cat;
    let attempts = 0;

    // Retry up to 5 times to avoid showing a duplicate cat
    do {
      const res = await fetch(`${CAT_API_URL}?limit=1`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      cat = { id: data[0].id, url: data[0].url };
      attempts++;
    } while (isDuplicate(cat.id) && attempts < 5);

    currentCat = cat;
    viewedCats.push(cat);
    viewedCount++;

    displayCat(cat);
    updateHistory();
    updateStats();

  } catch (err) {
    console.error('Failed to fetch cat:', err);
    showError();
  }
}

// ===========================
// DISPLAY
// ===========================

/**
 * Renders a cat into the card area with a smooth fade-in.
 * @param {{ id: string, url: string }} cat
 */
function displayCat(cat) {
  const img = document.getElementById('catImg');
  const imgWrap = document.getElementById('catImgWrap');
  const idBadge = document.getElementById('catIdBadge');

  // Fade out old image while new one loads
  img.classList.add('loading-fade');
  img.onload = () => {
    img.classList.remove('loading-fade');
    hideSpinner();
    imgWrap.style.display = '';
    showActionButtons();

    // Update favorite button state
    const isFaved = favorites.some(f => f.id === cat.id);
    updateFavButton(isFaved);
  };

  img.onerror = () => {
    showError();
  };

  img.src = cat.url;
  idBadge.textContent = `ID: ${cat.id}`;
  hideError();
}

/** Shows the loading spinner */
function showSpinner() {
  document.getElementById('spinnerWrap').style.display = '';
  document.getElementById('catImgWrap').style.display = 'none';
  document.getElementById('errorState').style.display = 'none';
}

/** Hides the loading spinner */
function hideSpinner() {
  document.getElementById('spinnerWrap').style.display = 'none';
}

/** Shows the error state */
function showError() {
  document.getElementById('spinnerWrap').style.display = 'none';
  document.getElementById('catImgWrap').style.display = 'none';
  document.getElementById('errorState').style.display = '';
}

/** Hides the error state */
function hideError() {
  document.getElementById('errorState').style.display = 'none';
}

/** Makes action buttons visible */
function showActionButtons() {
  const btns = document.getElementById('actionButtons');
  btns.style.opacity = '1';
  btns.style.pointerEvents = '';
}

/** Makes action buttons invisible (while loading) */
function hideActionButtons() {
  const btns = document.getElementById('actionButtons');
  btns.style.opacity = '0';
  btns.style.pointerEvents = 'none';
}

// ===========================
// HISTORY STRIP
// ===========================

/**
 * Rebuilds the horizontal history strip
 * showing the last 20 unique cats viewed this session.
 */
function updateHistory() {
  const strip = document.getElementById('historyStrip');
  const recent = [...viewedCats].reverse().slice(0, 20);

  if (recent.length === 0) {
    strip.innerHTML = '<p class="empty-msg">Your recently viewed cats will appear here!</p>';
    return;
  }

  strip.innerHTML = recent.map(cat => `
    <div class="history-thumb" title="Cat ID: ${cat.id}" onclick="previewCat('${cat.id}', '${cat.url}')">
      <img src="${cat.url}" alt="Cat ${cat.id}" loading="lazy"/>
    </div>
  `).join('');
}

/**
 * Clicking a history thumbnail re-displays that cat.
 * @param {string} id
 * @param {string} url
 */
function previewCat(id, url) {
  currentCat = { id, url };
  displayCat({ id, url });
  showSpinner();
}

// ===========================
// STATS
// ===========================

/** Updates the stats bar counters */
function updateStats() {
  document.getElementById('viewedCount').textContent = viewedCount;
  document.getElementById('streakCount').textContent = streak;
  document.getElementById('savedCount').textContent = favorites.length;
  document.getElementById('favBadge').textContent = favorites.length;
}

// ===========================
// FAVORITES
// ===========================

/**
 * Toggles the current cat's favorite status.
 * Persists favorites to localStorage.
 */
function toggleFavorite() {
  if (!currentCat) return;

  const isFaved = favorites.some(f => f.id === currentCat.id);

  if (isFaved) {
    // Remove from favorites
    favorites = favorites.filter(f => f.id !== currentCat.id);
    updateFavButton(false);
    streak = Math.max(0, streak - 1);
    showToast('Removed from favorites 💔');
  } else {
    // Add to favorites
    favorites.push({ ...currentCat });
    updateFavButton(true);
    streak++;
    showToast('Added to favorites! ❤️');
  }

  saveFavoritesToStorage();
  updateStats();
  renderFavorites();
}

/**
 * Updates the favorite button's visual state.
 * @param {boolean} isFaved
 */
function updateFavButton(isFaved) {
  const btn = document.getElementById('favBtn');
  if (isFaved) {
    btn.textContent = '💔 Unfave';
    btn.classList.add('active');
  } else {
    btn.textContent = '❤️ Favorite';
    btn.classList.remove('active');
  }
}

/**
 * Removes a cat from favorites by ID.
 * @param {string} catId
 */
function removeFavorite(catId) {
  favorites = favorites.filter(f => f.id !== catId);
  saveFavoritesToStorage();
  updateStats();
  renderFavorites();
  showToast('Removed from favorites 💔');

  // Update the fav button if this cat is currently displayed
  if (currentCat && currentCat.id === catId) {
    updateFavButton(false);
  }
}

/** Removes all favorites after confirmation */
function clearAllFavorites() {
  if (favorites.length === 0) return;
  if (!confirm('Remove all favorites? This cannot be undone!')) return;
  favorites = [];
  streak = 0;
  saveFavoritesToStorage();
  updateStats();
  renderFavorites();
  showToast('All favorites cleared 🗑️');
}

/**
 * Renders the favorites grid on the Favorites page.
 */
function renderFavorites() {
  const grid = document.getElementById('favsGrid');

  if (favorites.length === 0) {
    grid.innerHTML = `
      <div class="empty-favs">
        <p>😿 No favorites yet!<br/>Go heart some cats!</p>
        <button class="btn btn-primary" onclick="showPage('home')">Find Cats</button>
      </div>`;
    return;
  }

  grid.innerHTML = favorites.map((cat, i) => `
    <div class="fav-item" style="animation-delay: ${i * 0.05}s">
      <img src="${cat.url}" alt="Cat ${cat.id}" loading="lazy"/>
      <div class="fav-item-footer">
        <span class="fav-item-id" title="${cat.id}">${cat.id}</span>
        <button class="fav-remove-btn" onclick="removeFavorite('${cat.id}')" title="Remove">✕</button>
      </div>
    </div>
  `).join('');
}

// ===========================
// LOCALSTORAGE
// ===========================

/** Saves the favorites array to localStorage */
function saveFavoritesToStorage() {
  try {
    localStorage.setItem('catdrop_favorites', JSON.stringify(favorites));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

/** Loads favorites from localStorage on page load */
function loadFavoritesFromStorage() {
  try {
    const stored = localStorage.getItem('catdrop_favorites');
    if (stored) {
      favorites = JSON.parse(stored);
      updateStats();
      renderFavorites();
    }
  } catch (e) {
    console.warn('Could not load from localStorage:', e);
    favorites = [];
  }
}

// ===========================
// UTILITIES
// ===========================

/**
 * Copies the current cat's ID to clipboard.
 */
async function copyCatId() {
  if (!currentCat) return;
  try {
    await navigator.clipboard.writeText(currentCat.id);
    showToast('Cat ID copied! 📋');
  } catch {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = currentCat.id;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Cat ID copied! 📋');
  }
}

/**
 * Uses the Web Share API if available, otherwise copies the URL.
 */
async function shareCat() {
  if (!currentCat) return;
  const shareData = {
    title: 'Look at this cat!',
    text: `Check out this adorable cat! Cat ID: ${currentCat.id}`,
    url: currentCat.url,
  };

  if (navigator.share) {
    try {
      await navigator.share(shareData);
      showToast('Shared! 📤');
    } catch (e) {
      if (e.name !== 'AbortError') showToast('Share failed 😿');
    }
  } else {
    // Fallback: copy URL
    try {
      await navigator.clipboard.writeText(currentCat.url);
      showToast('Image URL copied! 🔗');
    } catch {
      showToast('Sharing not supported 😿');
    }
  }
}

/**
 * Triggers a download of the current cat image.
 */
async function downloadCat() {
  if (!currentCat) return;
  try {
    const res = await fetch(currentCat.url);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cat-${currentCat.id}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Downloading your cat! ⬇️');
  } catch {
    showToast('Download failed 😿');
  }
}

/**
 * Checks whether a cat ID has already been viewed this session.
 * @param {string} id
 * @returns {boolean}
 */
function isDuplicate(id) {
  return viewedCats.some(c => c.id === id);
}

// ===========================
// NAVIGATION
// ===========================

/**
 * Switches between pages (home / favorites).
 * @param {'home'|'favorites'} page
 */
function showPage(page) {
  currentPage = page;

  document.getElementById('homePage').style.display = page === 'home' ? '' : 'none';
  document.getElementById('favoritesPage').style.display = page === 'favorites' ? '' : 'none';

  document.getElementById('homeBtn').classList.toggle('active', page === 'home');
  document.getElementById('favsBtn').classList.toggle('active', page === 'favorites');

  if (page === 'favorites') renderFavorites();
}

// ===========================
// THEME
// ===========================

/** Toggles between light and dark mode */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  document.getElementById('themeToggle').textContent = isDark ? '🌙' : '☀️';
  try {
    localStorage.setItem('catdrop_theme', isDark ? 'light' : 'dark');
  } catch {}
}

// Restore saved theme preference
try {
  const savedTheme = localStorage.getItem('catdrop_theme');
  if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('themeToggle').textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }
} catch {}

// ===========================
// TOAST NOTIFICATION
// ===========================

let toastTimer = null;

/**
 * Shows a toast notification with a message.
 * @param {string} message
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}