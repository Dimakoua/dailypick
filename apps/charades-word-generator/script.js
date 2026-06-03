(function () {
  "use strict";

  const WORDS = {
    movies: {
      easy: [
        "The Lion King", "Frozen", "Toy Story", "Finding Nemo", "Shrek",
        "Harry Potter", "Star Wars", "Spider-Man", "Batman", "Superman",
        "The Matrix", "Titanic", "Jurassic Park", "Home Alone", "Aladdin",
        "Coco", "Moana", "Up", "Cars", "The Incredibles"
      ],
      medium: [
        "The Godfather", "Pulp Fiction", "Inception", "Interstellar",
        "The Dark Knight", "Fight Club", "Forrest Gump", "Gladiator",
        "The Prestige", "Whiplash", "Parasite", "Joker",
        "The Departed", "Dune", "Alien", "Blade Runner",
        "Goodfellas", "The Shawshank Redemption", "Saving Private Ryan", "Braveheart"
      ],
      hard: [
        "Schindler's List", "The Green Mile", "No Country for Old Men",
        "There Will Be Blood", "The Grand Budapest Hotel", "Moonlight",
        "The Revenant", "Birdman", "12 Angry Men", "Apocalypse Now",
        "A Clockwork Orange", "Eternal Sunshine of the Spotless Mind",
        "The Truman Show", "Memento", "Mulholland Drive",
        "The Big Lebowski", "Donnie Darko", "Her", "Gravity", "Arrival"
      ]
    },
    actions: {
      easy: [
        "Swimming", "Dancing", "Cooking", "Sleeping", "Running",
        "Jumping", "Climbing", "Singing", "Painting", "Reading",
        "Writing", "Eating", "Drinking", "Walking", "Crying",
        "Laughing", "Yawning", "Stretching", "Clapping", "Waving"
      ],
      medium: [
        "Juggling", "Sneezing", "Whistling", "Meditating", "Skateboarding",
        "Surfing", "Kayaking", "Gardening", "Knitting", "Fencing",
        "Archery", "Bowling", "Fishing", "Camping", "Hiking",
        "Snowboarding", "Breakdancing", "Doing yoga", "Playing guitar", "Taking a selfie"
      ],
      hard: [
        "Tightrope walking", "Doing a handstand", "Parallel parking",
        "Threading a needle", "Solving a Rubik's cube", "Doing origami",
        "Playing chess", "Mime trapped in a box", "Walking a dog",
        "Changing a tire", "Folding a fitted sheet", "Wrapping a gift",
        "Peeling an apple in one strip", "Doing the worm", "Moonwalking",
        "Playing an invisible accordion", "Hula hooping", "Doing parkour",
        "Puppeteering", "Shadow puppet animals"
      ]
    },
    animals: {
      easy: [
        "Dog", "Cat", "Elephant", "Lion", "Tiger",
        "Monkey", "Bear", "Rabbit", "Horse", "Cow",
        "Pig", "Chicken", "Duck", "Fish", "Bird",
        "Snake", "Frog", "Turtle", "Penguin", "Dolphin"
      ],
      medium: [
        "Giraffe", "Kangaroo", "Zebra", "Hippo", "Rhino",
        "Gorilla", "Chimpanzee", "Octopus", "Shark", "Whale",
        "Eagle", "Owl", "Parrot", "Peacock", "Flamingo",
        "Crocodile", "Alligator", "Panda", "Koala", "Sloth"
      ],
      hard: [
        "Platypus", "Aardvark", "Chameleon", "Narwhal", "Axolotl",
        "Quokka", "Pangolin", "Capybara", "Wombat", "Lemur",
        "Meerkat", "Porcupine", "Armadillo", "Toucan", "Mandrill",
        "Binturong", "Fennec fox", "Serval", "Okapi", "Tapir"
      ]
    },
    objects: {
      easy: [
        "Chair", "Table", "Lamp", "Phone", "Book",
        "Clock", "Mirror", "Umbrella", "Key", "Ball",
        "Bottle", "Cup", "Plate", "Spoon", "Pillow",
        "Blanket", "Shoe", "Hat", "Bag", "Television"
      ],
      medium: [
        "Stapler", "Telescope", "Compass", "Binoculars", "Flashlight",
        "Toaster", "Blender", "Vacuum cleaner", "Iron", "Hair dryer",
        "Sewing machine", "Typewriter", "Microscope", "Calculator", "Camera",
        "Guitar", "Violin", "Drum", "Harmonica", "Accordion"
      ],
      hard: [
        "Abacus", "Hourglass", "Sextant", "Astrolabe", "Gyroscope",
        "Trebuquet", "Catapult", "Kaleidoscope", "Periscope", "Metronome",
        "Thimble", "Spinning wheel", "Loom", "Anvil", "Vise",
        "Bellows", "Mortar and pestle", "Hourglass", "Compass rose", "Ouija board"
      ]
    },
    food: {
      easy: [
        "Pizza", "Burger", "Taco", "Pasta", "Sushi",
        "Sandwich", "Salad", "Soup", "Steak", "Fries",
        "Ice cream", "Cake", "Cookie", "Donut", "Pancake",
        "Waffle", "Hot dog", "Burrito", "Popcorn", "Chocolate"
      ],
      medium: [
        "Lasagna", "Risotto", "Pad Thai", "Falafel", "Hummus",
        "Guacamole", "Croissant", "Bagel", "Ramen", "Pho",
        "Dumplings", "Spring rolls", "Paella", "Gnocchi", "Empanada",
        "Shawarma", "Kebab", "Bibimbap", "Rendang", "Moussaka"
      ],
      hard: [
        "Bouillabaisse", "Coq au vin", "Beef Wellington", "Soufflé",
        "Crème brûlée", "Tiramisu", "Baklava", "Peking duck",
        "Osso buco", "Ratatouille", "Cassoulet", "Gazpacho",
        "Ceviche", "Kimchi", "Natto", "Haggis", "Borscht",
        "Pierogi", "Schnitzel", "Fondue"
      ]
    }
  };

  const DIFFICULTY_HINTS = {
    easy: "Great for kids and beginners!",
    medium: "A solid challenge for most players.",
    hard: "Only for charades veterans!"
  };

  // DOM elements
  const categoryButtons = document.querySelectorAll(".category-btn");
  const difficultyButtons = document.querySelectorAll(".difficulty-btn");
  const generateBtn = document.getElementById("generateBtn");
  const copyBtn = document.getElementById("copyBtn");
  const timerBtn = document.getElementById("timerBtn");
  const wordDisplay = document.getElementById("wordDisplay");
  const hintText = document.getElementById("hintText");
  const timerDisplay = document.getElementById("timerDisplay");
  const timerValue = document.getElementById("timerValue");

  let activeCategory = "movies";
  let activeDifficulty = "easy";
  let timerInterval = null;
  let timerRemaining = 60;
  let timerRunning = false;

  // Category selection
  categoryButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      categoryButtons.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");
      activeCategory = btn.dataset.category;
    });
  });

  // Difficulty selection
  difficultyButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
      difficultyButtons.forEach(function (b) {
        b.classList.remove("active");
        b.setAttribute("aria-checked", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-checked", "true");
      activeDifficulty = btn.dataset.difficulty;
    });
  });

  function chooseRandom(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function getWordList() {
    if (activeCategory === "all") {
      const allCategories = ["movies", "actions", "animals", "objects", "food"];
      const combined = [];
      allCategories.forEach(function (cat) {
        if (WORDS[cat] && WORDS[cat][activeDifficulty]) {
          combined.push.apply(combined, WORDS[cat][activeDifficulty]);
        }
      });
      return combined;
    }
    return WORDS[activeCategory][activeDifficulty];
  }

  function generateWord() {
    const list = getWordList();
    const word = chooseRandom(list);

    wordDisplay.textContent = word;
    wordDisplay.classList.remove("pop");
    // Force reflow to restart animation
    void wordDisplay.offsetWidth;
    wordDisplay.classList.add("pop");

    hintText.textContent = DIFFICULTY_HINTS[activeDifficulty];

    // Reset timer if running
    if (timerRunning) {
      stopTimer();
    }
  }

  function copyWord() {
    const text = wordDisplay.textContent;
    if (!text || text === "Click Generate Word to get started!") return;

    navigator.clipboard.writeText(text).then(function () {
      var original = copyBtn.textContent;
      copyBtn.textContent = "✅ Copied";
      setTimeout(function () {
        copyBtn.textContent = original;
      }, 1500);
    }).catch(function () {
      copyBtn.textContent = "⚠️ Failed";
      setTimeout(function () {
        copyBtn.textContent = "📋 Copy";
      }, 1500);
    });
  }

  function startTimer() {
    if (timerRunning) {
      stopTimer();
      return;
    }

    timerRemaining = 60;
    timerDisplay.hidden = false;
    timerValue.textContent = timerRemaining;
    timerDisplay.classList.remove("pulse");
    timerRunning = true;
    timerBtn.textContent = "⏹️ Stop Timer";

    timerInterval = setInterval(function () {
      timerRemaining--;
      timerValue.textContent = timerRemaining;

      if (timerRemaining <= 10) {
        timerDisplay.classList.add("pulse");
      }

      if (timerRemaining <= 0) {
        stopTimer();
        timerValue.textContent = "0";
      }
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerRunning = false;
    timerBtn.textContent = "⏱️ Start Timer";
    timerDisplay.classList.remove("pulse");
    timerDisplay.hidden = true;
  }

  // Event listeners
  generateBtn.addEventListener("click", generateWord);
  copyBtn.addEventListener("click", copyWord);
  timerBtn.addEventListener("click", startTimer);

  // Keyboard shortcuts
  window.addEventListener("keydown", function (e) {
    var isFormControl = e.target.tagName === "TEXTAREA" ||
                        e.target.tagName === "INPUT" ||
                        e.target.tagName === "SELECT" ||
                        e.target.contentEditable === "true";
    if (isFormControl) return;

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      generateWord();
    }
    if (e.key.toLowerCase() === "t") startTimer();
    if (e.key.toLowerCase() === "c") copyWord();
  });
})();
