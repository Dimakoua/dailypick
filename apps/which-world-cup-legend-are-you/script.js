const legends = {
    "pele": {
        name: "Pelé",
        emoji: "👑",
        bio: "The King of Football. With three World Cup titles, you share his pure joy for the game and clinical efficiency in the box. You make the impossible look easy.",
        traits: ["Legendary", "Clinical", "Inspirational"]
    },
    "messi": {
        name: "Lionel Messi",
        emoji: "🐐",
        bio: "The Creative Genius. Like Messi in 2022, you lead through quiet brilliance and unmatched vision. You don't just play the game; you orchestrate it.",
        traits: ["Creative", "Visionary", "Decisive"]
    },
    "maradona": {
        name: "Diego Maradona",
        emoji: "🔟",
        bio: "The Golden Boy. You possess the raw emotion and rebellious talent that defined Maradona. You are a force of nature who can carry a whole nation on your shoulders.",
        traits: ["Passionate", "Unpredictable", "Iconic"]
    },
    "ronaldo": {
        name: "Cristiano Ronaldo",
        emoji: "🦾",
        bio: "The Ultimate Professional. Your game is built on relentless discipline, power, and the will to win. You are a machine that thrives under the highest pressure.",
        traits: ["Disciplined", "Powerful", "Ambitious"]
    },
    "zidane": {
        name: "Zinedine Zidane",
        emoji: "🇫🇷",
        bio: "The Midfield General. You share Zidane's elegance and big-game temperament. You stay calm when the world is watching and strike with perfect timing.",
        traits: ["Elegant", "Calm", "Impactful"]
    },
    "beckenbauer": {
        name: "Franz Beckenbauer",
        emoji: "🛡️",
        bio: "The Emperor. You are a natural-born leader who sees the game from a higher perspective. You organize, command, and lead from the back with total class.",
        traits: ["Leader", "Intelligent", "Classy"]
    },
    "cruyff": {
        name: "Johan Cruyff",
        emoji: "🇳🇱",
        bio: "The Architect of Total Football. You value intelligence and philosophy as much as skill. You don't just want to win; you want to change how the game is played.",
        traits: ["Philosophical", "Innovative", "Smart"]
    }
};

const questions = [
    {
        text: "It's the 90th minute of a World Cup Final and you're tied. What's your move?",
        options: [
            { text: "Dribble through the entire defense yourself.", legend: "maradona" },
            { text: "Find the perfect pass nobody else sees.", legend: "messi" },
            { text: "Wait for the perfect cross and finish it clinically.", legend: "pele" },
            { text: "Organize the defense to ensure we don't concede first.", legend: "beckenbauer" }
        ]
    },
    {
        text: "How do you prepare for the biggest match of your life?",
        options: [
            { text: "Extra training sessions and strict diet.", legend: "ronaldo" },
            { text: "Visualizing the flow of the game and tactical movements.", legend: "cruyff" },
            { text: "Staying calm and trusting my natural elegance.", legend: "zidane" },
            { text: "Feeding off the energy and passion of the fans.", legend: "maradona" }
        ]
    },
    {
        text: "What is your greatest strength on the pitch?",
        options: [
            { text: "Unstoppable physical power and speed.", legend: "ronaldo" },
            { text: "Changing the tempo of the game with one touch.", legend: "zidane" },
            { text: "Always being in the right place at the right time.", legend: "pele" },
            { text: "Seeing three steps ahead of everyone else.", legend: "cruyff" }
        ]
    },
    {
        text: "What kind of leader are you?",
        options: [
            { text: "The vocal captain who commands the field.", legend: "beckenbauer" },
            { text: "Leading by example with pure skill.", legend: "messi" },
            { text: "The emotional heart who inspires the team.", legend: "maradona" },
            { text: "The perfectionist who demands the best from others.", legend: "ronaldo" }
        ]
    },
    {
        text: "What does football mean to you?",
        options: [
            { text: "It's a beautiful art form.", legend: "messi" },
            { text: "It's a tactical battle of wits.", legend: "beckenbauer" },
            { text: "It's pure joy and goals.", legend: "pele" },
            { text: "It's a platform for revolution and ideas.", legend: "cruyff" }
        ]
    },
    {
        text: "The opposition is playing dirty. How do you react?",
        options: [
            { text: "Keep my cool and humiliate them with skill.", legend: "zidane" },
            { text: "Fight back with even more passion and intensity.", legend: "maradona" },
            { text: "Let my goals do the talking.", legend: "pele" },
            { text: "Adjust the tactics to exploit their aggression.", legend: "cruyff" }
        ]
    },
    {
        text: "If you could only have one quality, which would it be?",
        options: [
            { text: "Perfect technique.", legend: "messi" },
            { text: "Unbreakable mentality.", legend: "ronaldo" },
            { text: "Absolute authority.", legend: "beckenbauer" },
            { text: "Effortless grace.", legend: "zidane" }
        ]
    }
];

let currentQuestionIndex = 0;
let scores = {};

// Initialize scores
Object.keys(legends).forEach(key => scores[key] = 0);

const startScreen = document.getElementById('start-screen');
const questionScreen = document.getElementById('question-screen');
const resultScreen = document.getElementById('result-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const progressText = document.getElementById('progress-text');
const progressBar = document.getElementById('progress-bar');

const legendName = document.getElementById('legend-name');
const legendEmoji = document.getElementById('legend-emoji');
const legendBio = document.getElementById('legend-bio');
const traitTags = document.getElementById('trait-tags');

function startQuiz() {
    currentQuestionIndex = 0;
    Object.keys(scores).forEach(key => scores[key] = 0);
    
    startScreen.hidden = true;
    resultScreen.hidden = true;
    questionScreen.hidden = false;
    
    showQuestion();
}

function showQuestion() {
    const q = questions[currentQuestionIndex];
    questionText.textContent = q.text;
    progressText.textContent = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
    progressBar.style.width = `${(currentQuestionIndex / questions.length) * 100}%`;
    
    optionsContainer.innerHTML = '';
    
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = opt.text;
        btn.onclick = () => handleAnswer(opt.legend);
        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(legendKey) {
    scores[legendKey]++;
    
    currentQuestionIndex++;
    if (currentQuestionIndex < questions.length) {
        showQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    questionScreen.hidden = true;
    resultScreen.hidden = false;
    
    // Find legend with highest score
    let winnerKey = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b);
    
    // Handle ties by picking a random one among tied keys
    const maxScore = scores[winnerKey];
    const tiedKeys = Object.keys(scores).filter(key => scores[key] === maxScore);
    winnerKey = tiedKeys[Math.floor(Math.random() * tiedKeys.length)];
    
    const legend = legends[winnerKey];
    
    legendName.textContent = legend.name;
    legendEmoji.textContent = legend.emoji;
    legendBio.textContent = legend.bio;
    
    traitTags.innerHTML = '';
    legend.traits.forEach(trait => {
        const span = document.createElement('span');
        span.className = 'trait-tag';
        span.textContent = trait;
        traitTags.appendChild(span);
    });
}

startBtn.onclick = startQuiz;
restartBtn.onclick = startQuiz;
