(function () {
  const STORAGE_KEY = 'dailypick_truth_or_dare';

  // Prompt database organized by difficulty and type
  const prompts = {
    truth: {
      easy: [
        { text: "What's your guilty pleasure?", category: 'funny' },
        { text: "Have you ever pretended to like a gift you didn't?", category: 'funny' },
        { text: "What's your most embarrassing search history?", category: 'funny' },
        { text: "Do you prefer showers or baths?", category: 'icebreaker' },
        { text: "What's your favorite snack nobody knows about?", category: 'funny' },
        { text: "Have you ever sung in public?", category: 'icebreaker' },
        { text: "What's your weirdest talent?", category: 'funny' },
        { text: "If you could have any superpower for a day, what would it be?", category: 'icebreaker' },
        { text: "What's something you lied about to seem cool?", category: 'funny' },
        { text: "Have you ever eaten something off the floor?", category: 'funny' },
      ],
      medium: [
        { text: "Have you ever had a crush on a friend's partner?", category: 'spicy' },
        { text: "What's the most dramatic thing you've done for drama?", category: 'funny' },
        { text: "Have you ever ghosted someone?", category: 'spicy' },
        { text: "What's your worst financial decision?", category: 'team' },
        { text: "Have you ever cried at a movie? Which one?", category: 'icebreaker' },
        { text: "What's something you're jealous about?", category: 'spicy' },
        { text: "Have you ever lied to a friend about their outfit?", category: 'funny' },
        { text: "What's your most controversial opinion?", category: 'team' },
        { text: "Have you ever checked someone's phone without asking?", category: 'spicy' },
        { text: "What would you do if you could swap lives for a day?", category: 'icebreaker' },
      ],
      hard: [
        { text: "What's something you've never told anyone?", category: 'spicy' },
        { text: "Have you ever stolen from a store?", category: 'spicy' },
        { text: "What's the most embarrassing thing that's happened to you?", category: 'spicy' },
        { text: "Have you ever been attracted to someone much older/younger?", category: 'spicy' },
        { text: "What's your biggest regret?", category: 'spicy' },
        { text: "Have you ever felt genuine hatred toward someone?", category: 'spicy' },
        { text: "What's something you did that you hope nobody finds out?", category: 'spicy' },
        { text: "Have you broken someone's heart deliberately?", category: 'spicy' },
        { text: "What's the most illegal thing you've ever done?", category: 'spicy' },
        { text: "Who in this group would you least want as a roommate and why?", category: 'spicy' },
      ]
    },
    dare: {
      easy: [
        { text: "Do a silly dance for 10 seconds", category: 'funny' },
        { text: "Sing a line from your favorite song", category: 'funny' },
        { text: "Imitate someone in the room without saying their name", category: 'funny' },
        { text: "Do your best impression of a celebrity", category: 'funny' },
        { text: "Swap a piece of clothing with someone for 3 minutes", category: 'funny' },
        { text: "Stand on one leg for the next 2 minutes", category: 'icebreaker' },
        { text: "Pretend to be a robot and walk around", category: 'funny' },
        { text: "Talk with an accent for the next round", category: 'funny' },
        { text: "Make a silly face and hold it for 10 seconds", category: 'funny' },
        { text: "Do 10 jumping jacks right now", category: 'icebreaker' },
      ],
      medium: [
        { text: "Text someone you haven't talked to in a while and say hi", category: 'team' },
        { text: "Lick your elbow (or try!)", category: 'funny' },
        { text: "Prank call one of your friends", category: 'funny' },
        { text: "Google yourself and tell us the first embarrassing thing you find", category: 'spicy' },
        { text: "Post something silly on your social media story", category: 'spicy' },
        { text: "Let someone else choose what you eat for the next hour", category: 'funny' },
        { text: "Hold hands with the person to your left for 2 rounds", category: 'icebreaker' },
        { text: "Wear your shirt inside out for the next round", category: 'funny' },
        { text: "Change your profile picture to a weird one for 24 hours", category: 'spicy' },
        { text: "Call someone in the room and tell them a fake rumor about yourself", category: 'funny' },
      ],
      hard: [
        { text: "Share your browser history for 30 seconds", category: 'spicy' },
        { text: "Let someone read your last 5 text messages", category: 'spicy' },
        { text: "Call an ex and tell them you miss them", category: 'spicy' },
        { text: "Post an unflattering photo of yourself with a caption", category: 'spicy' },
        { text: "Send a flirty text to someone in this room (don't show who)", category: 'spicy' },
        { text: "Kiss someone in the room (with consent!)", category: 'spicy' },
        { text: "Tell someone their biggest flaw", category: 'spicy' },
        { text: "Apologize to someone you've wronged and mean it", category: 'spicy' },
        { text: "Confess something you've been holding in to the group", category: 'spicy' },
        { text: "Give someone here a real compliment while maintaining eye contact", category: 'spicy' },
      ]
    }
  };

  // DOM elements
  const truthBtn = document.getElementById('truthBtn');
  const dareBtn = document.getElementById('dareBtn');
  const skipBtn = document.getElementById('skipBtn');
  const copyBtn = document.getElementById('copyBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const addCustomBtn = document.getElementById('addCustomBtn');
  const customPromptInput = document.getElementById('customPrompt');
  const difficultySelect = document.getElementById('difficultySelect');
  const categoryCheckboxes = document.querySelectorAll('.checkbox-group input[type="checkbox"]');
  const promptType = document.getElementById('promptType');
  const promptText = document.getElementById('promptText');
  const promptTag = document.getElementById('promptTag');
  const promptDifficulty = document.getElementById('promptDifficulty');
  const historyList = document.getElementById('historyList');

  let currentPrompt = null;
  let history = [];
  let customPrompts = { truth: [], dare: [] };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved) {
        history = Array.isArray(saved.history) ? saved.history : [];
        customPrompts = saved.customPrompts || { truth: [], dare: [] };
        updateHistoryUI();
      }
    } catch (e) {
      // ignore
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ history, customPrompts }));
    } catch (e) {
      // ignore
    }
  }

  function getSelectedCategories() {
    return Array.from(categoryCheckboxes)
      .filter(cb => cb.checked)
      .map(cb => cb.value);
  }

  function getDifficulty() {
    return difficultySelect.value;
  }

  function getPromptPool(type) {
    const difficulty = getDifficulty();
    const categories = getSelectedCategories();
    const pool = prompts[type][difficulty];
    const custom = customPrompts[type];

    const filtered = pool.filter(p => categories.includes(p.category));
    const all = [...filtered, ...custom];

    return all.length > 0 ? all : pool;
  }

  function pickPrompt(type) {
    const pool = getPromptPool(type);
    if (!pool.length) return;

    const prompt = pool[Math.floor(Math.random() * pool.length)];
    currentPrompt = { ...prompt, type };

    promptType.textContent = type === 'truth' ? '🎭 TRUTH' : '🔥 DARE';
    promptType.className = `prompt-type prompt-type--${type}`;
    promptText.textContent = prompt.text;
    promptTag.textContent = prompt.category || 'custom';
    promptDifficulty.textContent = getDifficulty();

    history.unshift(currentPrompt);
    if (history.length > 20) history.pop();
    updateHistoryUI();
    saveState();
  }

  function updateHistoryUI() {
    if (!history.length) {
      historyList.innerHTML = '<p class="placeholder">No prompts yet</p>';
      return;
    }

    historyList.innerHTML = history.slice(0, 10).map((h, i) => 
      `<div class="history-item">
        <span class="history-type">${h.type === 'truth' ? '🎭' : '🔥'}</span>
        <span>${h.text}</span>
      </div>`
    ).join('');
  }

  function copyPrompt() {
    if (!currentPrompt) return;
    const text = `${currentPrompt.type === 'truth' ? '🎭' : '🔥'} ${currentPrompt.text}`;
    navigator.clipboard.writeText(text).then(() => {
      const origText = copyBtn.textContent;
      copyBtn.textContent = '✅ Copied';
      setTimeout(() => { copyBtn.textContent = origText; }, 1200);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
  }

  truthBtn.addEventListener('click', () => pickPrompt('truth'));
  dareBtn.addEventListener('click', () => pickPrompt('dare'));
  skipBtn.addEventListener('click', () => pickPrompt(Math.random() > 0.5 ? 'truth' : 'dare'));
  copyBtn.addEventListener('click', copyPrompt);

  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Clear all history?')) {
      history = [];
      updateHistoryUI();
      saveState();
    }
  });

  addCustomBtn.addEventListener('click', () => {
    const text = customPromptInput.value.trim();
    if (!text) return;

    // Ask if it's truth or dare
    const type = prompt('Is this a TRUTH or DARE? (type truth or dare)').toLowerCase();
    if (type !== 'truth' && type !== 'dare') return;

    const custom = { text, category: 'custom' };
    customPrompts[type].push(custom);
    customPromptInput.value = '';
    updateHistoryUI();
    saveState();
    alert(`✅ "${text}" added!`);
  });

  window.addEventListener('keydown', (e) => {
    const isFormControl = e.target.tagName === 'TEXTAREA' || 
                          e.target.tagName === 'INPUT' || 
                          e.target.tagName === 'SELECT' ||
                          e.target.contentEditable === 'true';
    
    if (isFormControl) return; // Don't intercept keys when typing in form controls
    
    if (e.key.toLowerCase() === 't') pickPrompt('truth');
    if (e.key.toLowerCase() === 'd') pickPrompt('dare');
    if (e.key === ' ') {
      e.preventDefault();
      pickPrompt(Math.random() > 0.5 ? 'truth' : 'dare');
    }
  });

  loadState();
})();
