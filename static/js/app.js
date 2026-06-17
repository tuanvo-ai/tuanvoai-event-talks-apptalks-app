// State Management
let releaseNotes = [];
let activeFilters = new Set(['Feature', 'Deprecation', 'Issue', 'Change', 'Announcement', 'General']);
let searchQuery = '';

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = refreshBtn.querySelector('.icon-refresh');
const searchInput = document.getElementById('search-input');
const filterTagsContainer = document.getElementById('filter-tags-container');
const timelineList = document.getElementById('timeline-list');
const noResults = document.getElementById('no-results');
const cacheStatus = document.getElementById('cache-status');
const cacheStatusText = document.getElementById('cache-status-text');
const scrollTopBtn = document.getElementById('scroll-top-btn');

// Stats DOM Elements
const valTotalDays = document.getElementById('val-total-days');
const valTotalUpdates = document.getElementById('val-total-updates');
const valFeatures = document.getElementById('val-features');
const valIssues = document.getElementById('val-issues');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  fetchReleaseNotes();
  setupEventListeners();
});

// Event Listeners Setup
function setupEventListeners() {
  // Refresh Button click
  refreshBtn.addEventListener('click', () => {
    fetchReleaseNotes(true);
  });

  // Search Input change
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    renderTimeline();
  });

  // Category Filters click
  filterTagsContainer.addEventListener('click', (e) => {
    const filterTag = e.target.closest('.filter-tag');
    if (!filterTag) return;

    const category = filterTag.getAttribute('data-type');
    
    if (category === 'All') {
      const isAllActive = filterTag.classList.contains('active');
      const tags = filterTagsContainer.querySelectorAll('.filter-tag');
      
      if (isAllActive) {
        // Deactivate all
        tags.forEach(t => t.classList.remove('active'));
        activeFilters.clear();
      } else {
        // Activate all
        tags.forEach(t => t.classList.add('active'));
        activeFilters = new Set(['Feature', 'Deprecation', 'Issue', 'Change', 'Announcement', 'General']);
      }
    } else {
      // Toggle individual filter
      const allTag = filterTagsContainer.querySelector('[data-type="All"]');
      
      if (activeFilters.has(category)) {
        activeFilters.delete(category);
        filterTag.classList.remove('active');
        allTag.classList.remove('active');
      } else {
        activeFilters.add(category);
        filterTag.classList.add('active');
        
        // If all tags are now active, highlight the "All" tag
        if (activeFilters.size === 6) {
          allTag.classList.add('active');
        }
      }
    }
    
    renderTimeline();
  });

  // Scroll to top button functionality
  window.addEventListener('scroll', () => {
    if (window.scrollY > 400) {
      scrollTopBtn.classList.remove('hidden');
    } else {
      scrollTopBtn.classList.add('hidden');
    }
  });

  scrollTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Handle Tweet button click via delegation
  timelineList.addEventListener('click', (e) => {
    const btn = e.target.closest('.tweet-share-btn');
    if (!btn) return;
    
    const updateItem = btn.closest('.update-item');
    if (!updateItem) return;
    
    const date = updateItem.getAttribute('data-date');
    const type = updateItem.getAttribute('data-type');
    const link = updateItem.getAttribute('data-link');
    const descEl = updateItem.querySelector('.update-description');
    
    // Strip HTML/Mark highlights to get clean text
    const cleanText = descEl.textContent || descEl.innerText || '';
    
    shareOnTwitter(date, type, cleanText, link);
  });
}

// Fetch Data from API
async function fetchReleaseNotes(forceRefresh = false) {
  setLoadingState(true);
  
  try {
    const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch release notes from API');
    
    const result = await response.json();
    
    if (result.status === 'success') {
      releaseNotes = result.data;
      updateCacheStatus(result.cached);
      updateDashboardStats();
      renderTimeline();
      
      if (forceRefresh) {
        showToast('Successfully updated release notes!', 'success');
      }
    } else {
      throw new Error(result.message || 'Unknown API error');
    }
  } catch (error) {
    console.error('Error fetching release notes:', error);
    showToast(`Error: ${error.message}`, 'error');
    if (releaseNotes.length === 0) {
      timelineList.innerHTML = '';
      noResults.classList.remove('hidden');
    }
  } finally {
    setLoadingState(false);
  }
}

// Handle Loading Visuals
function setLoadingState(isLoading) {
  if (isLoading) {
    refreshBtn.disabled = true;
    refreshIcon.classList.add('spinning');
    
    // Show cache status as Loading
    cacheStatus.className = 'cache-status status-loading';
    cacheStatusText.textContent = 'Syncing...';
    
    // Show Skeletons
    timelineList.innerHTML = `
      <div class="skeleton-entry">
        <div class="skeleton-date"></div>
        <div class="skeleton-card">
          <div class="skeleton-header"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text short"></div>
        </div>
      </div>
      <div class="skeleton-entry">
        <div class="skeleton-date"></div>
        <div class="skeleton-card">
          <div class="skeleton-header"></div>
          <div class="skeleton-text"></div>
          <div class="skeleton-text short"></div>
        </div>
      </div>
    `;
    noResults.classList.add('hidden');
  } else {
    refreshBtn.disabled = false;
    refreshIcon.classList.remove('spinning');
  }
}

// Update Cache Status indicator
function updateCacheStatus(isCached) {
  if (isCached) {
    cacheStatus.className = 'cache-status status-cached';
    cacheStatusText.textContent = 'Data (Local Cache)';
  } else {
    cacheStatus.className = 'cache-status status-live';
    cacheStatusText.textContent = 'Data (Live Feed)';
  }
}

// Update Dashboard Statistics Cards
function updateDashboardStats() {
  valTotalDays.textContent = releaseNotes.length;
  
  let totalUpdates = 0;
  let features = 0;
  let issues = 0;
  
  releaseNotes.forEach(entry => {
    totalUpdates += entry.updates.length;
    entry.updates.forEach(update => {
      const type = update.type.toLowerCase();
      if (type.includes('feature')) features++;
      if (type.includes('issue') || type.includes('bug') || type.includes('fix')) issues++;
    });
  });
  
  valTotalUpdates.textContent = totalUpdates;
  valFeatures.textContent = features;
  valIssues.textContent = issues;
}

// Render Timeline Content
function renderTimeline() {
  timelineList.innerHTML = '';
  
  // Filter entries
  const filteredEntries = [];
  
  releaseNotes.forEach(entry => {
    // Filter updates inside the entry
    const matchingUpdates = entry.updates.filter(update => {
      const matchesCategory = activeFilters.has(update.type);
      const matchesSearch = searchQuery === '' || 
        update.type.toLowerCase().includes(searchQuery) || 
        update.description.toLowerCase().includes(searchQuery) ||
        entry.title.toLowerCase().includes(searchQuery);
        
      return matchesCategory && matchesSearch;
    });
    
    if (matchingUpdates.length > 0) {
      filteredEntries.push({
        ...entry,
        updates: matchingUpdates
      });
    }
  });
  
  if (filteredEntries.length === 0) {
    noResults.classList.remove('hidden');
    return;
  }
  
  noResults.classList.add('hidden');
  
  // Create fragment for high-performance DOM updates
  const fragment = document.createDocumentFragment();
  
  filteredEntries.forEach((entry, index) => {
    // Format Date: e.g. "June 16, 2026"
    // Split date into parts
    const dateParts = entry.title.split(',');
    const monthDay = dateParts[0].trim();
    const year = dateParts[1] ? dateParts[1].trim() : '';
    
    const entryEl = document.createElement('div');
    entryEl.className = 'timeline-entry';
    // Cascading delays for stagger animations
    entryEl.style.animationDelay = `${index * 0.05}s`;
    
    // HTML structure for card
    let updatesHtml = '';
    entry.updates.forEach(update => {
      const badgeClass = getBadgeClass(update.type);
      updatesHtml += `
        <div class="update-item" data-date="${entry.title}" data-type="${update.type}" data-link="${entry.link || ''}">
          <div class="update-header">
            <span class="badge ${badgeClass}">${update.type}</span>
            <button class="tweet-share-btn" title="Tweet about this update" aria-label="Tweet about this update">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
              </svg>
            </button>
          </div>
          <div class="update-description">
            ${highlightSearch(update.description, searchQuery)}
          </div>
        </div>
      `;
    });
    
    entryEl.innerHTML = `
      <div class="timeline-date-wrapper">
        <span class="timeline-date">${monthDay}</span>
        ${year ? `<span class="timeline-date-year">${year}</span>` : ''}
      </div>
      <div class="timeline-badge-node"></div>
      <div class="timeline-card-wrapper">
        <div class="timeline-card">
          <div class="timeline-card-header">
            <h2 class="timeline-card-title">${entry.title}</h2>
            ${entry.link ? `
              <a href="${entry.link}" target="_blank" rel="noopener noreferrer" class="timeline-link-btn" title="View official release notes">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            ` : ''}
          </div>
          <div class="update-items">
            ${updatesHtml}
          </div>
        </div>
      </div>
    `;
    
    fragment.appendChild(entryEl);
  });
  
  timelineList.appendChild(fragment);
}

// Helpers: Badge Classes mapping
function getBadgeClass(type) {
  const t = type.toLowerCase();
  if (t.includes('feature')) return 'badge-feature';
  if (t.includes('deprecation')) return 'badge-deprecation';
  if (t.includes('issue') || t.includes('bug') || t.includes('fix')) return 'badge-issue';
  if (t.includes('change')) return 'badge-change';
  if (t.includes('announcement')) return 'badge-announcement';
  return 'badge-general';
}

// Helper: Highlights search queries in text
function highlightSearch(text, query) {
  if (!query) return text;
  // Use a regex that ignores tags to avoid breaking HTML structure
  // This matches target words outside of HTML tag configurations.
  try {
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})(?![^<>]*>)`, 'gi');
    return text.replace(regex, '<mark style="background-color: rgba(6, 182, 212, 0.3); color: #fff; padding: 2px 0px; border-radius: 2px;">$1</mark>');
  } catch (e) {
    return text;
  }
}

// Toast System
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icon = type === 'success' ? '✅' : '❌';
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  
  container.appendChild(toast);
  
  // Remove toast after animation duration
  setTimeout(() => {
    toast.style.animation = 'slideInLeft 0.2s reverse forwards';
    setTimeout(() => {
      toast.remove();
    }, 200);
  }, 4000);
}

// Share Update to Twitter/X
function shareOnTwitter(date, type, cleanText, link) {
  // Normalize whitespace
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  // Build Tweet components
  const header = `BigQuery Update [${date}] (${type}): `;
  const footer = `\n\n#GoogleCloud #BigQuery`;
  
  // Total characters limit is 280
  const linkSpace = link ? ` ${link}` : '';
  const reservedLength = header.length + footer.length + linkSpace.length;
  const maxBodyLength = 280 - reservedLength;
  
  let tweetBody = cleanText;
  if (tweetBody.length > maxBodyLength) {
    tweetBody = tweetBody.slice(0, maxBodyLength - 3) + '...';
  }
  
  const tweetText = `${header}${tweetBody}${footer}${linkSpace}`;
  const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  
  window.open(tweetUrl, '_blank', 'noopener,noreferrer');
}
