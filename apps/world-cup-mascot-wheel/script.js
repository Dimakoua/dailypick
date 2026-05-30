const mascotData = {
    // todo: fix links
    "World Cup Willie": {
        year: "1966 England",
        image: "https://upload.wikimedia.org/wikipedia/en/2/2f/World_Cup_Willie.png",
        fact: "The first-ever World Cup mascot. A lion wearing a Union Flag jersey with 'WORLD CUP' on it."
    },
    "Juanito": {
        year: "1970 Mexico",
        image: "https://en.wikipedia.org/wiki/Special:FilePath/1970_FIFA_World_Cup_mascot.png",
        fact: "A boy wearing Mexico's kit and a sombrero with the words 'MEXICO 70'. Represented the innocence of the game."
    },
    "Tip and Tap": {
        year: "1974 West Germany",
        image: "https://upload.wikimedia.org/wikipedia/en/e/e0/1974_FIFA_World_Cup_mascot.png",
        fact: "Two boys wearing German kits. Tip had 'WM' (Weltmeisterschaft) and Tap had '74' on their jerseys."
    },
    "Gauchito": {
        year: "1978 Argentina",
        image: "https://upload.wikimedia.org/wikipedia/en/7/77/1978_FIFA_World_Cup_mascot.png",
        fact: "A boy in traditional Argentine rancher (Gaucho) clothing, including a hat, neckerchief, and whip."
    },
    "Naranjito": {
        year: "1982 Spain",
        image: "https://upload.wikimedia.org/wikipedia/en/8/83/1982_FIFA_World_Cup_mascot.png",
        fact: "The first fruit mascot! An orange (typical of Spain) wearing the national team's kit."
    },
    "Pique": {
        year: "1986 Mexico",
        image: "https://upload.wikimedia.org/wikipedia/en/6/67/1986_FIFA_World_Cup_mascot.png",
        fact: "A jalapeño pepper with a mustache and sombrero. His name comes from 'picante' (spicy)."
    },
    "Ciao": {
        year: "1990 Italy",
        image: "https://upload.wikimedia.org/wikipedia/en/c/c5/1990_FIFA_World_Cup_mascot.png",
        fact: "A stick figure player with a football for a head, made of tricolor blocks (green, white, and red)."
    },
    "Striker": {
        year: "1994 USA",
        image: "https://upload.wikimedia.org/wikipedia/en/f/f6/1994_FIFA_World_Cup_mascot.png",
        fact: "A friendly dog wearing a red, white, and blue soccer kit. Chosen by the American public."
    },
    "Footix": {
        year: "1998 France",
        image: "https://upload.wikimedia.org/wikipedia/en/a/a2/1998_FIFA_World_Cup_mascot.png",
        fact: "A blue rooster, the national symbol of France. His name is a portmanteau of 'football' and the '-ix' suffix from Asterix."
    },
    "The Spheriks": {
        year: "2002 South Korea/Japan",
        image: "https://upload.wikimedia.org/wikipedia/en/b/ba/2002_FIFA_World_Cup_mascot.png",
        fact: "Three computer-generated creatures: Ato (orange), Kaz (purple), and Nik (blue). They played 'Atmoball'."
    },
    "Goleo VI": {
        year: "2006 Germany",
        image: "https://upload.wikimedia.org/wikipedia/en/7/7b/2006_FIFA_World_Cup_mascot.png",
        fact: "A lion wearing a Germany shirt with the number 06, accompanied by a talking football named Pille."
    },
    "Zakumi": {
        year: "2010 South Africa",
        image: "https://en.wikipedia.org/wiki/Special:FilePath/Zakumi.svg",
        fact: "A leopard with green hair. His name comes from 'ZA' (South Africa) and 'kumi' (ten in several African languages)."
    },
    "Fuleco": {
        year: "2014 Brazil",
        image: "https://en.wikipedia.org/wiki/Special:FilePath/Fuleco.png",
        fact: "A Brazilian three-banded armadillo. His name combines 'Futebol' (Football) and 'Ecologia' (Ecology)."
    },
    "Zabivaka": {
        year: "2018 Russia",
        image: "https://upload.wikimedia.org/wikipedia/en/6/60/2018_FIFA_World_Cup_mascot.png",
        fact: "A wolf whose name translates to 'The one who scores'. He wears sports goggles to protect his eyes from speed."
    },
    "La'eeb": {
        year: "2022 Qatar",
        image: "https://upload.wikimedia.org/wikipedia/en/d/db/2022_FIFA_World_Cup_mascot.png",
        fact: "An ethereal flying mascot resembling a keffiyeh. His name is an Arabic word meaning 'super-skilled player'."
    }
};

const mascotList = Object.keys(mascotData);

FoodWheelEngine.init({
    canvasSelector: "#wheel",
    spinButtonSelector: "#spinBtn",
    winnerSelector: "#winner",
    presetButtonSelector: ".preset-btn",
    defaultItems: mascotList,
    enableConfetti: true,
    resultFormatter: function (selectedItem) {
        const mascot = mascotData[selectedItem];
        const imageUrl = mascot.image;
        const imageHtml = imageUrl
            ? `<img src="${imageUrl}" alt="${selectedItem}" class="mascot-image" loading="lazy" onerror="this.style.display='none'">`
            : '';
        return `
            <div class="mascot-result-card">
                ${imageHtml}
                <span class="mascot-name">${selectedItem}</span>
                <span class="mascot-year">${mascot.year}</span>
                <p class="mascot-fact">${mascot.fact}</p>
            </div>
        `;
    }
});
