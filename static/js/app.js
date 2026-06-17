// State Management
let releaseNotes = [];
let activeFilters = new Set(['Feature', 'Deprecation', 'Issue', 'Change', 'Announcement', 'General']);
let searchQuery = '';

// DOM Elements
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = refreshBtn.querySelector('.icon-refresh');
const exportCsvBtn = document.getElementById('export-csv-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
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
  initTheme();
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
    const tags = filterTagsContainer.querySelectorAll('.filter-tag');
    const allTag = filterTagsContainer.querySelector('[data-type="All"]');
    
    if (category === 'All') {
      const isAllActive = allTag.classList.contains('active');
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
      // Solo filtering logic
      const isCurrentlySolo = activeFilters.size === 1 && activeFilters.has(category);
      
      if (isCurrentlySolo) {
        // If clicked again when already soloed, reset to All active
        tags.forEach(t => t.classList.add('active'));
        activeFilters = new Set(['Feature', 'Deprecation', 'Issue', 'Change', 'Announcement', 'General']);
      } else {
        // Solo the clicked category
        tags.forEach(t => t.classList.remove('active'));
        filterTag.classList.add('active');
        allTag.classList.remove('active');
        
        activeFilters.clear();
        activeFilters.add(category);
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

  // Handle Export CSV Button click
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      exportToCSV();
    });
  }

  // Handle Theme Toggle Button click
  if (themeToggleBtn) {
    const iconSun = themeToggleBtn.querySelector('.icon-sun');
    const iconMoon = themeToggleBtn.querySelector('.icon-moon');
    
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      
      if (isLight) {
        localStorage.setItem('theme', 'light');
        iconSun.classList.remove('hidden');
        iconMoon.classList.add('hidden');
        showToast('Switched to Light Mode', 'success');
      } else {
        localStorage.setItem('theme', 'dark');
        iconSun.classList.add('hidden');
        iconMoon.classList.remove('hidden');
        showToast('Switched to Dark Mode', 'success');
      }
    });
  }

  // Handle Timeline clicks via delegation (Tweet & Copy)
  timelineList.addEventListener('click', (e) => {
    // 1. Tweet button click
    const tweetBtn = e.target.closest('.tweet-share-btn');
    if (tweetBtn) {
      const updateItem = tweetBtn.closest('.update-item');
      if (updateItem) {
        const date = updateItem.getAttribute('data-date');
        const type = updateItem.getAttribute('data-type');
        const link = updateItem.getAttribute('data-link');
        const descEl = updateItem.querySelector('.update-description');
        const cleanText = descEl.textContent || descEl.innerText || '';
        shareOnTwitter(date, type, cleanText, link);
      }
      return;
    }

    // 2. Card Copy to Clipboard button click
    const copyBtn = e.target.closest('.card-copy-btn');
    if (copyBtn) {
      const card = copyBtn.closest('.timeline-card');
      const date = card.getAttribute('data-title');
      const link = card.getAttribute('data-link');
      const updateItems = card.querySelectorAll('.update-item');
      
      let copyText = `BigQuery Release Notes - ${date}\n\n`;
      updateItems.forEach(item => {
        const type = item.getAttribute('data-type');
        const descEl = item.querySelector('.update-description');
        const cleanDesc = descEl.textContent || descEl.innerText || '';
        copyText += `[${type}] ${cleanDesc.trim()}\n\n`;
      });
      
      if (link) {
        copyText += `Read more: ${link}`;
      }
      
      navigator.clipboard.writeText(copyText.trim())
        .then(() => {
          showToast(`Copied release notes for ${date} to clipboard!`, 'success');
          // Visual feedback checkmark
          const originalSvg = copyBtn.innerHTML;
          copyBtn.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-feature);">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          setTimeout(() => {
            copyBtn.innerHTML = originalSvg;
          }, 2000);
        })
        .catch(() => {
          showToast('Failed to copy to clipboard', 'error');
        });
    }
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
        <div class="timeline-card" data-title="${entry.title}" data-link="${entry.link || ''}">
          <div class="timeline-card-header">
            <h2 class="timeline-card-title">${entry.title}</h2>
            <div class="card-actions-wrapper" style="display: flex; gap: 10px; align-items: center;">
              <button class="card-copy-btn timeline-link-btn" style="background: transparent; border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;" title="Copy Release Notes for this day">
                <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
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

// Export release notes to CSV
function exportToCSV() {
  const filtered = [];
  
  releaseNotes.forEach(entry => {
    const matching = entry.updates.filter(update => {
      const matchesCategory = activeFilters.has(update.type);
      const matchesSearch = searchQuery === '' || 
        update.type.toLowerCase().includes(searchQuery) || 
        update.description.toLowerCase().includes(searchQuery) ||
        entry.title.toLowerCase().includes(searchQuery);
      return matchesCategory && matchesSearch;
    });
    
    if (matching.length > 0) {
      filtered.push({
        ...entry,
        updates: matching
      });
    }
  });

  if (filtered.length === 0) {
    showToast('No data to export matching filters', 'error');
    return;
  }

  // Build CSV
  const headers = ["Date", "Type", "Description", "Link"];
  const csvRows = [headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",")];

  filtered.forEach(entry => {
    entry.updates.forEach(update => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = update.description;
      const cleanDesc = (tempDiv.textContent || tempDiv.innerText || "").trim().replace(/\s+/g, ' ');

      const row = [
        entry.title,
        update.type,
        cleanDesc,
        entry.link || ""
      ];
      csvRows.push(row.map(field => `"${field.replace(/"/g, '""')}"`).join(","));
    });
  });

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `bigquery_release_notes_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('CSV exported successfully!', 'success');
}

// Helper: Initialize Theme
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (!themeToggleBtn) return;
  
  const iconSun = themeToggleBtn.querySelector('.icon-sun');
  const iconMoon = themeToggleBtn.querySelector('.icon-moon');
  
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    if (iconSun) iconSun.classList.remove('hidden');
    if (iconMoon) iconMoon.classList.add('hidden');
  } else {
    document.body.classList.remove('light-theme');
    if (iconSun) iconSun.classList.add('hidden');
    if (iconMoon) iconMoon.classList.remove('hidden');
  }
}
