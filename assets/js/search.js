// Fuzzy search database with all games and navigation
const SEARCH_DATABASE = [
  // Standup Games
  { name: 'Wheel', path: '/apps/wheel/', category: 'standup', emoji: '🎡' },
  { name: 'Speedway', path: '/apps/speedway/', category: 'standup', emoji: '🐢' },
  { name: 'Trap', path: '/apps/trap/', category: 'standup', emoji: '🎯' },
  { name: 'Falling Letters Pinball', path: '/apps/letters/', category: 'standup', emoji: '🕹️' },
  { name: 'Gravity Drift', path: '/apps/gravity-drift/', category: 'standup', emoji: '🚀' },
  { name: 'Patchinko Machine', path: '/apps/patchinko-machine/', category: 'standup', emoji: '🎳' },
  { name: 'Momentum Mayhem', path: '/apps/ballgame/', category: 'standup', emoji: '🔴' },
  { name: 'Mimic Master', path: '/apps/mimic-master/', category: 'standup', emoji: '🖐️' },
  { name: 'Snowball Fight', path: '/apps/snowball-fight/', category: 'standup', emoji: '⛄' },
  
  // Agile Planning
  { name: 'Planning Poker', path: '/apps/planning-poker/', category: 'agile', emoji: '🃏' },
  { name: 'Retro Board', path: '/apps/retro-board/', category: 'agile', emoji: '📋' },
  { name: 'Capacity Dice', path: '/apps/capacity-dice/', category: 'agile', emoji: '🎲' },
  { name: 'Morale Thermometer', path: '/apps/morale-thermometer/', category: 'agile', emoji: '🌡️' },
  { name: 'Timer', path: '/apps/timer/', category: 'agile', emoji: '⏱️' },
  
  // Randomizers
  { name: 'Random Name Picker', path: '/apps/random-name-picker/', category: 'randomizer', emoji: '📝' },
  { name: 'Classroom Name Roulette', path: '/apps/classroom-name-roulette/', category: 'randomizer', emoji: '🎓' },
  { name: 'Random List Shuffler', path: '/apps/random-list-shuffler/', category: 'randomizer', emoji: '🔀' },
  { name: 'Giveaway Winner Picker', path: '/apps/giveaway-winner-picker/', category: 'randomizer', emoji: '🏆' },
  { name: 'Raffle Ticket Puller', path: '/apps/raffle-ticket-puller/', category: 'randomizer', emoji: '🎫' },
  { name: 'Coin Flip Dice Roller', path: '/apps/coin-flip-dice-roller/', category: 'randomizer', emoji: '🪙' },
  { name: 'Truth or Dare', path: '/apps/truth-or-dare/', category: 'randomizer', emoji: '🎲' },
  { name: 'What Should I Eat?', path: '/apps/what-should-i-eat/', category: 'randomizer', emoji: '🍕' },
  { name: 'Choices Spinner', path: '/apps/choices-spinner/', category: 'randomizer', emoji: '🎡' },
  
  // Navigation
  { name: 'Settings', path: '/apps/settings/', category: 'nav', emoji: '⚙️' },
  { name: 'Agile Planning Hub', path: '/agile/', category: 'nav', emoji: '📊' },
  { name: 'Randomizers Hub', path: '/randomizers/', category: 'nav', emoji: '🎲' },
  { name: 'Blog', path: '/blog/', category: 'nav', emoji: '📚' },
  { name: 'Feedback', path: '/feedback/', category: 'nav', emoji: '💬' },
];

// Simple fuzzy search algorithm
function fuzzySearch(query, items) {
  if (!query.trim()) return [];
  
  const lowerQuery = query.toLowerCase();
  
  return items
    .map(item => {
      const lowerName = item.name.toLowerCase();
      let score = 0;
      let matchedIndices = [];
      
      // Exact match gets highest score
      if (lowerName === lowerQuery) {
        return { ...item, score: 1000, matchedIndices: [] };
      }
      
      // Starts with query
      if (lowerName.startsWith(lowerQuery)) {
        score = 500;
      }
      
      // Calculate fuzzy match score
      let queryIdx = 0;
      for (let i = 0; i < lowerName.length && queryIdx < lowerQuery.length; i++) {
        if (lowerName[i] === lowerQuery[queryIdx]) {
          score += 100 - i; // Earlier matches score higher
          matchedIndices.push(i);
          queryIdx++;
        }
      }
      
      // Only return if all query characters were found
      if (queryIdx === lowerQuery.length) {
        return { ...item, score, matchedIndices };
      }
      
      return null;
    })
    .filter(item => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8); // Return top 8 results
}

// Initialize search functionality
function initSearch() {
  const searchContainer = document.getElementById('search-container');
  if (!searchContainer) return;
  
  const searchInput = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  let activeIndex = -1;
  
  if (!searchInput || !searchResults) return;
  
  // Handle input
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
  
  // Handle keyboard navigation
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
  
  // Close search on blur
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch);
} else {
  initSearch();
}
