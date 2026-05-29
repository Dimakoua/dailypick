const questions = [
    {
        question: "In what year was FIFA founded in Paris?",
        options: ["1888", "1904", "1920", "1930"],
        answer: 1 // 1904
    },
    {
        question: "Which country won the inaugural FIFA Women's World Cup in 1991?",
        options: ["Norway", "Germany", "United States", "China"],
        answer: 2 // United States
    },
    {
        question: "Which African nation became the first to ever reach a World Cup semifinal in 2022?",
        options: ["Cameroon", "Senegal", "Ghana", "Morocco"],
        answer: 3 // Morocco
    },
    {
        question: "Who is the youngest player to ever score a goal in a FIFA World Cup match?",
        options: ["Pelé", "Kylian Mbappé", "Lionel Messi", "Gavi"],
        answer: 0 // Pelé (17 years, 239 days old in 1958)
    },
    {
        question: "Which country won the first-ever UEFA European Championship in 1960?",
        options: ["Soviet Union", "Yugoslavia", "Spain", "France"],
        answer: 0 // Soviet Union
    },
    {
        question: "Who won the first-ever Ballon d'Or award in 1956?",
        options: ["Alfredo Di Stéfano", "Stanley Matthews", "Raymond Kopa", "Ferenc Puskás"],
        answer: 1 // Stanley Matthews
    },
    {
        question: "Which club has won the most UEFA Champions League (European Cup) titles?",
        options: ["AC Milan", "FC Barcelona", "Bayern Munich", "Real Madrid"],
        answer: 3 // Real Madrid
    },
    {
        question: "What was the name of the original FIFA World Cup trophy used from 1930 to 1970?",
        options: ["Jules Rimet Trophy", "Henri Delaunay Trophy", "FIFA World Cup Trophy", "The Football Association Cup"],
        answer: 0 // Jules Rimet Trophy
    },
    {
        question: "Which country hosted the 1994 FIFA World Cup, setting an all-time tournament attendance record?",
        options: ["Italy", "United States", "France", "Mexico"],
        answer: 1 // United States
    },
    {
        question: "Which player famously received a red card for headbutting Marco Materazzi in the 2006 World Cup Final?",
        options: ["Thierry Henry", "Patrick Vieira", "Zinedine Zidane", "David Trezeguet"],
        answer: 2 // Zinedine Zidane
    },
    {
        question: "Which country will jointly host the 2026 FIFA World Cup alongside the United States and Mexico?",
        options: ["Canada", "Brazil", "Costa Rica", "Jamaica"],
        answer: 0 // Canada
    },
    {
        question: "Who is the all-time top goalscorer in the UEFA Champions League?",
        options: ["Lionel Messi", "Robert Lewandowski", "Raúl", "Cristiano Ronaldo"],
        answer: 3 // Cristiano Ronaldo
    },
    {
        question: "Which nation has won the most FIFA Women's World Cup titles?",
        options: ["Germany", "United States", "Japan", "Norway"],
        answer: 1 // United States (4 titles)
    },
    {
        question: "In 1998, which nation won its first-ever World Cup title on home soil?",
        options: ["France", "England", "Argentina", "Germany"],
        answer: 0 // France
    },
    {
        question: "Which English club has won the most top-flight domestic league titles in history?",
        options: ["Arsenal", "Liverpool", "Manchester United", "Manchester City"],
        answer: 2 // Manchester United (20 titles)
    },
    {
        question: "Who holds the record for the fastest goal in FIFA World Cup history, scoring in just 10.8 seconds in 2002?",
        options: ["Clint Dempsey", "Hakan Şükür", "Alphonso Davies", "Christian Eriksen"],
        answer: 1 // Hakan Şükür
    },
    {
        question: "Which nation is the only one to have participated in every single FIFA World Cup tournament since its inception?",
        options: ["Germany", "Italy", "Argentina", "Brazil"],
        answer: 3 // Brazil
    },
    {
        question: "Who holds the record for playing the most matches in FIFA World Cup history (26 appearances)?",
        options: ["Lothar Matthäus", "Lionel Messi", "Paolo Maldini", "Diego Maradona"],
        answer: 1 // Lionel Messi
    },
    {
        question: "Who scored the very first goal in FIFA World Cup history during the 1930 tournament?",
        options: ["Guillermo Stábile", "Alcides Ghiggia", "Lucien Laurent", "Arthur Friedenreich"],
        answer: 2 // Lucien Laurent
    },
    {
        question: "The 2026 FIFA World Cup, hosted by the US, Canada, and Mexico, will be the first edition to feature how many teams?",
        options: ["32", "36", "40", "48"],
        answer: 3 // 48
    },
    {
        question: "Who is the oldest player to ever appear in a World Cup match, doing so at 45 years old in 2018?",
        options: ["Roger Milla", "Dino Zoff", "Essam El-Hadary", "Faryd Mondragón"],
        answer: 2 // Essam El-Hadary
    },
    {
        question: "Which two nations are the only ones to have successfully defended their World Cup title (won back-to-back)?",
        options: ["Brazil and Germany", "Italy and Brazil", "Uruguay and Argentina", "France and Spain"],
        answer: 1 // Italy (1934, 1938) and Brazil (1958, 1962)
    },
    {
        question: "What is the highest-scoring match in World Cup history (12 goals total)?",
        options: ["Austria 7-5 Switzerland (1954)", "Hungary 10-1 El Salvador (1982)", "Brazil 7-1 Germany (2014)", "Yugoslavia 9-0 Zaire (1974)"],
        answer: 0 // Austria 7-5 Switzerland
    },
    {
        question: "Which goalkeeper holds the record for the longest consecutive run without conceding a goal (517 minutes) in World Cup history?",
        options: ["Gianluigi Buffon", "Iker Casillas", "Oliver Kahn", "Walter Zenga"],
        answer: 3 // Walter Zenga (1990)
    },
    {
        question: "Which of these goalkeepers is the only one to have ever won the Golden Ball (best player of the tournament)?",
        options: ["Lev Yashin", "Oliver Kahn", "Manuel Neuer", "Fabien Barthez"],
        answer: 1 // Oliver Kahn (2002)
    },
    {
        question: "Who scored the quickest hat-trick in World Cup history (7 minutes and 42 seconds) after coming on as a substitute in 1982?",
        options: ["László Kiss", "Gerd Müller", "Gabriel Batistuta", "Gary Lineker"],
        answer: 0 // László Kiss
    },
    {
        question: "Which nation earned the right to permanently keep the original Jules Rimet Trophy after winning it for a third time in 1970?",
        options: ["Uruguay", "Italy", "West Germany", "Brazil"],
        answer: 3 // Brazil
    },
    {
        question: "In 1938, who became the first player to score four goals in a single World Cup match?",
        options: ["Just Fontaine", "Ernst Wilimowski", "Sandor Kocsis", "Leonidas"],
        answer: 1 // Ernst Wilimowski
    },
    {
        question: "Which player joined Geoff Hurst in 2022 as the only players to ever score a hat-trick in a World Cup Final?",
        options: ["Lionel Messi", "Antoine Griezmann", "Kylian Mbappé", "Angel Di Maria"],
        answer: 2 // Kylian Mbappé
    },
    {
        question: "The 2022 FIFA World Cup in Qatar was the first tournament in history to...",
        options: ["Use Video Assistant Referees (VAR)", "Be hosted by two or more countries", "Be held in the Northern Hemisphere's winter", "Feature goal-line technology"],
        answer: 2 // Be held in the Northern Hemisphere's winter
    }
];

let currentQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let canAnswer = true;

const startScreen = document.getElementById('start-screen');
const questionScreen = document.getElementById('question-screen');
const resultScreen = document.getElementById('result-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const progressText = document.getElementById('progress-text');
const progressBar = document.getElementById('progress-bar');
const feedback = document.getElementById('feedback');

const resultIcon = document.getElementById('result-icon');
const resultTitle = document.getElementById('result-title');
const resultText = document.getElementById('result-text');
const resultMessage = document.getElementById('result-message');

function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}

function startQuiz() {
    currentQuestions = shuffle([...questions]).slice(0, 10);
    currentQuestionIndex = 0;
    score = 0;
    canAnswer = true;
    
    startScreen.hidden = true;
    resultScreen.hidden = true;
    questionScreen.hidden = false;
    
    showQuestion();
}

function showQuestion() {
    const q = currentQuestions[currentQuestionIndex];
    questionText.textContent = q.question;
    progressText.textContent = `Question ${currentQuestionIndex + 1} of 10`;
    progressBar.style.width = `${(currentQuestionIndex / 10) * 100}%`;
    
    optionsContainer.innerHTML = '';
    feedback.hidden = true;
    canAnswer = true;
    
    q.options.forEach((opt, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt;
        btn.onclick = () => handleAnswer(index);
        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(selectedIndex) {
    if (!canAnswer) return;
    canAnswer = false;
    
    const q = currentQuestions[currentQuestionIndex];
    const btns = optionsContainer.querySelectorAll('.option-btn');
    
    if (selectedIndex === q.answer) {
        score++;
        btns[selectedIndex].classList.add('correct');
        showFeedback(true);
    } else {
        btns[selectedIndex].classList.add('incorrect');
        btns[q.answer].classList.add('correct');
        showFeedback(false);
    }
    
    setTimeout(() => {
        currentQuestionIndex++;
        if (currentQuestionIndex < 10) {
            showQuestion();
        } else {
            showResults();
        }
    }, 1500);
}

function showFeedback(isCorrect) {
    feedback.textContent = isCorrect ? "✅ Correct!" : "❌ Incorrect";
    feedback.className = `feedback-msg ${isCorrect ? 'correct' : 'incorrect'}`;
    feedback.hidden = false;
}

function showResults() {
    questionScreen.hidden = true;
    resultScreen.hidden = false;
    
    resultText.textContent = `You scored ${score} out of 10.`;
    
    if (score === 10) {
        resultIcon.textContent = "🏆";
        resultTitle.textContent = "World Champion!";
        resultMessage.textContent = "Absolute perfection! You're a true World Cup historian.";
    } else if (score >= 8) {
        resultIcon.textContent = "🥇";
        resultTitle.textContent = "Expert Player!";
        resultMessage.textContent = "Fantastic knowledge! You're definitely ready for the next tournament.";
    } else if (score >= 5) {
        resultIcon.textContent = "🥈";
        resultTitle.textContent = "Strong Performance!";
        resultMessage.textContent = "Good job! You know your way around the beautiful game.";
    } else {
        resultIcon.textContent = "🥉";
        resultTitle.textContent = "Room for Improvement";
        resultMessage.textContent = "Not bad, but there's more to learn. Time to hit the history books!";
    }
}

startBtn.onclick = startQuiz;
restartBtn.onclick = startQuiz;
