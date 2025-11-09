document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('.rating-buttons button');
    const averageMoraleEl = document.getElementById('average-morale');
    const participantsEl = document.getElementById('participants');
    const mercuryEl = document.querySelector('.mercury');

    let session;

    function updateUI(state) {
        if (!state) return;

        const average = state.average || 0;
        const participants = state.participants || 0;

        averageMoraleEl.textContent = average.toFixed(2);
        participantsEl.textContent = participants;

        // Scale of 1-5, so max average is 5.
        const percentage = (average / 5) * 100;
        mercuryEl.style.height = `${percentage}%`;
    }

    function initializeSession() {
        const url = new URL(window.location);
        let sessionId = url.searchParams.get('session_id');
        if (!sessionId) {
            sessionId = 'morale-' + Math.random().toString(36).substr(2, 9);
            url.searchParams.set('session_id', sessionId);
            window.history.replaceState({}, '', url);
        }

        session = new MoraleThermometerSession(sessionId, (state) => {
            updateUI(state);
        });
    }

    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const value = parseInt(button.dataset.value, 10);
            session.sendVote(value);
            
            buttons.forEach(btn => btn.disabled = true);
            button.style.background = 'var(--brand-accent)';
            button.style.color = 'white';
        });
    });

    initializeSession();
});
