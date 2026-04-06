const SEARCH_DATABASE = [];

async function loadSearchData() {
  try {
    const response = await fetch('/assets/js/apps-data.json');
    if (!response.ok) {
      throw new Error(`Search data fetch failed (${response.status})`);
    }

    const data = await response.json();
    SEARCH_DATABASE.splice(0, SEARCH_DATABASE.length, ...data);
  } catch (error) {
    console.warn('Unable to load search data:', error);
  }
}

// Simple fuzzy search algorithm
function fuzzySearch(query, items) {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  
  return items
    .map(item => {
      const lowerName = item.name.toLowerCase();
      let score = 0;
      let matchedIndices = [];
      
      if (lowerName === lowerQuery) {
        return { ...item, score: 1000, matchedIndices: [] };
      }
      
      if (lowerName.startsWith(lowerQuery)) {
        score = 500;
      }
      
      let queryIdx = 0;
      for (let i = 0; i < lowerName.length && queryIdx < lowerQuery.length; i++) {
        if (lowerName[i] === lowerQuery[queryIdx]) {
          score += 100 - i;
          matchedIndices.push(i);
          queryIdx++;
        }
      }
      
      if (queryIdx === lowerQuery.length) {
        return { ...item, score, matchedIndices };
      }
      
      return null;
    })
    .filter(item => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}

function initSearch() {
  const searchContainer = document.getElementById('search-container');
  if (!searchContainer) return;
  
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  let activeIndex = -1;
  
  if (!searchInput || !searchResults) return;
  
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value;
    activeIndex = -1;
    
    if (!query.trim()) {
      searchResults.innerHTML = '';
      searchResults.classList.remove('active');
      return;
    }
    
    const results = fuzzySearch(query, SEARCH_DATABASE);
    
    if (results.length === 0) {
      searchResults.innerHTML = '<div class="search-result-item no-results">No games found</div>';
      searchResults.classList.add('active');
      return;
    }
    
    searchResults.innerHTML = results
      .map((result, index) => `
        <a href="${result.path}" class="search-result-item" data-index="${index}" aria-label="Go to ${result.name}">
          <span class="search-result-emoji">${result.emoji}</span>
          <span class="search-result-text">
            <span class="search-result-name">${result.name}</span>
            <span class="search-result-category">${result.category}</span>
          </span>
        </a>
      `)
      .join('');
    
    searchResults.classList.add('active');
  });
  
  searchInput.addEventListener('keydown', (e) => {
    const items = searchResults.querySelectorAll('.search-result-item:not(.no-results)');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
      updateActiveItem(items);
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      items[activeIndex].click();
    } else if (e.key === 'Escape') {
      searchResults.classList.remove('active');
      searchInput.blur();
      activeIndex = -1;
    }
  });
  
  searchInput.addEventListener('blur', () => {
    setTimeout(() => {
      searchResults.classList.remove('active');
    }, 150);
  });
  
  function updateActiveItem(items) {
    items.forEach((item, index) => {
      item.classList.toggle('active', index === activeIndex);
    });
    
    if (activeIndex >= 0) {
      items[activeIndex].scrollIntoView({ block: 'nearest' });
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    loadSearchData().then(initSearch);
  });
} else {
  loadSearchData().then(initSearch);
}
