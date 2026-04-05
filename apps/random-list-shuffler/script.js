(function () {
  const STORAGE_KEY = 'dailypick_random_list_shuffler';
  const DEFAULT_ITEMS = ['Apple', 'Banana', 'Cherry', 'Date', 'Elderberry'];

  const itemsInput = document.getElementById('itemsInput');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const resetBtn = document.getElementById('resetBtn');
  const clearBtn = document.getElementById('clearBtn');
  const copyBtn = document.getElementById('copyBtn');
  const resultList = document.getElementById('resultList');

  function parseItems() {
    const raw = itemsInput.value.trim();
    if (!raw) return [];
    return Array.from(new Set(raw.split(/[,\n]+/).map(s => s.trim()).filter(Boolean)));
  }

  function saveState(items, lastResult) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, lastResult }));
    } catch (e) {
      // ignore
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error('no');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length) {
        itemsInput.value = parsed.items.join('\n');
        if (Array.isArray(parsed.lastResult) && parsed.lastResult.length) renderResult(parsed.lastResult);
        return;
      }
    } catch (e) {
      itemsInput.value = DEFAULT_ITEMS.join('\n');
    }
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function renderResult(items) {
    resultList.innerHTML = '';
    if (!items || !items.length) {
      resultList.textContent = 'No result';
      return;
    }
    const frag = document.createDocumentFragment();
    items.forEach(it => {
      const li = document.createElement('li');
      li.textContent = it;
      frag.appendChild(li);
    });
    resultList.appendChild(frag);
  }

  function doShuffle() {
    const items = parseItems();
    if (!items.length) {
      renderResult([]);
      return;
    }
    const shuffled = shuffleArray(items);
    renderResult(shuffled);
    saveState(items, shuffled);
  }

  shuffleBtn.addEventListener('click', doShuffle);

  resetBtn.addEventListener('click', () => {
    itemsInput.value = DEFAULT_ITEMS.join('\n');
    renderResult([]);
    saveState(parseItems(), []);
  });

  clearBtn.addEventListener('click', () => {
    renderResult([]);
    saveState(parseItems(), []);
  });

  copyBtn.addEventListener('click', async () => {
    const items = Array.from(resultList.querySelectorAll('li')).map(li => li.textContent);
    if (!items.length) return;
    const text = items.join('\n');
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = '✅ Copied';
      setTimeout(() => { copyBtn.textContent = '📋 Copy Result'; }, 1200);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  });

  itemsInput.addEventListener('change', () => {
    saveState(parseItems(), Array.from(resultList.querySelectorAll('li')).map(li => li.textContent));
  });

  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      doShuffle();
    }
  });

  loadState();
})();
