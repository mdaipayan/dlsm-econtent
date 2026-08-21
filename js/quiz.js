// ===== Interactive quiz engine =====
// Each quiz is a `.quiz-card[data-quiz]` element containing:
//   - [data-quiz-questions]  empty container the questions render into
//   - [data-quiz-score]     small "Score: X/Y" badge
//   - [data-quiz-footer]    hidden footer shown once every question is answered
//   - [data-quiz-result]    result message text
//   - [data-quiz-retry]     "Retake Quiz" button
//   - script[type="application/json"][data-quiz-data]  JSON array of
//       { q: string, options: string[], correct: number, explain: string }
(function () {
  const quizzes = document.querySelectorAll('[data-quiz]');
  quizzes.forEach(initQuiz);

  function initQuiz(root) {
    const dataEl = root.querySelector('[data-quiz-data]');
    if (!dataEl) return;

    let questions;
    try {
      questions = JSON.parse(dataEl.textContent);
    } catch (e) {
      return;
    }
    if (!Array.isArray(questions) || !questions.length) return;

    const qContainer = root.querySelector('[data-quiz-questions]');
    const scoreEl = root.querySelector('[data-quiz-score]');
    const footer = root.querySelector('[data-quiz-footer]');
    const resultEl = root.querySelector('[data-quiz-result]');
    const retryBtn = root.querySelector('[data-quiz-retry]');
    if (!qContainer) return;

    let score = 0;
    let answered = 0;

    function render() {
      qContainer.innerHTML = '';
      score = 0;
      answered = 0;
      if (footer) footer.hidden = true;
      if (resultEl) resultEl.textContent = '';
      updateScore();

      questions.forEach((q, qi) => {
        const qEl = document.createElement('div');
        qEl.className = 'quiz-question';

        const qText = document.createElement('p');
        qText.className = 'quiz-question-text';
        qText.textContent = (qi + 1) + '. ' + q.q;
        qEl.appendChild(qText);

        const optsEl = document.createElement('div');
        optsEl.className = 'quiz-options';
        (q.options || []).forEach((opt, oi) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'quiz-option';
          btn.textContent = opt;
          btn.addEventListener('click', () => selectOption(qEl, optsEl, q, oi));
          optsEl.appendChild(btn);
        });
        qEl.appendChild(optsEl);

        const feedback = document.createElement('p');
        feedback.className = 'quiz-feedback';
        feedback.hidden = true;
        qEl.appendChild(feedback);

        qContainer.appendChild(qEl);
      });
    }

    function selectOption(qEl, optsEl, q, oi) {
      if (optsEl.classList.contains('is-answered')) return;
      optsEl.classList.add('is-answered');

      const buttons = Array.from(optsEl.children);
      buttons.forEach((b, i) => {
        b.disabled = true;
        if (i === q.correct) b.classList.add('is-correct');
        else if (i === oi) b.classList.add('is-incorrect');
      });

      const correct = oi === q.correct;
      if (correct) score++;

      const feedback = qEl.querySelector('.quiz-feedback');
      if (feedback) {
        feedback.hidden = false;
        feedback.classList.add(correct ? 'is-correct' : 'is-incorrect');
        feedback.textContent = (correct ? 'Correct — ' : 'Not quite — ') + (q.explain || '');
      }

      answered++;
      updateScore();
      if (answered === questions.length) showResult();
    }

    function updateScore() {
      if (scoreEl) scoreEl.textContent = 'Score: ' + score + '/' + questions.length;
    }

    function showResult() {
      if (!footer || !resultEl) return;
      footer.hidden = false;
      const pct = Math.round((score / questions.length) * 100);
      let msg;
      if (pct === 100) msg = 'Perfect score — you have this section down.';
      else if (pct >= 75) msg = 'Great work — just a small gap to close.';
      else if (pct >= 50) msg = 'Good start — revisit the parts you missed.';
      else msg = "Worth another read-through before you move on — you'll get it.";
      resultEl.textContent = 'You scored ' + score + ' out of ' + questions.length + ' (' + pct + '%). ' + msg;
    }

    if (retryBtn) retryBtn.addEventListener('click', render);
    render();
  }
})();
