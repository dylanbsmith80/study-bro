(function () {
  const MAX_ITEMS = 100;
  const BEST_KEY = "studyBroStackBestItemCount";

  const STACK_ITEMS = [
    {
      name: "textbook",
      difficulty: "easy",
      shape: "rectangle",
      width: 132,
      height: 36,
      density: 0.0026,
      friction: 0.98,
      restitution: 0.01,
      weight: 16,
      color: "#ffd43b",
      chamfer: 3
    },
    {
      name: "notebook",
      difficulty: "easy",
      shape: "rectangle",
      width: 118,
      height: 30,
      density: 0.0022,
      friction: 0.94,
      restitution: 0.02,
      weight: 15,
      color: "#b9f6ca",
      chamfer: 3
    },
    {
      name: "flashcard box",
      difficulty: "easy",
      shape: "rectangle",
      width: 86,
      height: 54,
      density: 0.0021,
      friction: 0.96,
      restitution: 0.015,
      weight: 13,
      color: "#ffffff",
      chamfer: 4
    },
    {
      name: "eraser",
      difficulty: "easy",
      shape: "rectangle",
      width: 66,
      height: 24,
      density: 0.002,
      friction: 0.92,
      restitution: 0.015,
      weight: 13,
      color: "#ffb3b3",
      chamfer: 5
    },
    {
      name: "calculator",
      difficulty: "medium",
      shape: "rectangle",
      width: 82,
      height: 56,
      density: 0.0024,
      friction: 0.82,
      restitution: 0.04,
      weight: 9,
      color: "#9ed7ff",
      chamfer: 5
    },
    {
      name: "coffee cup",
      difficulty: "medium",
      shape: "rectangle",
      width: 44,
      height: 82,
      density: 0.0018,
      friction: 0.76,
      restitution: 0.06,
      weight: 8,
      color: "#f6d5a8",
      chamfer: 9
    },
    {
      name: "backpack",
      difficulty: "medium",
      shape: "rectangle",
      width: 112,
      height: 70,
      density: 0.0027,
      friction: 0.78,
      restitution: 0.05,
      weight: 7,
      color: "#c7b7ff",
      chamfer: 14
    },
    {
      name: "sticky note stack",
      difficulty: "medium",
      shape: "rectangle",
      width: 58,
      height: 34,
      density: 0.0016,
      friction: 0.86,
      restitution: 0.025,
      weight: 9,
      color: "#fff38a",
      chamfer: 3
    },
    {
      name: "pencil",
      difficulty: "hard",
      shape: "rectangle",
      width: 142,
      height: 14,
      density: 0.0014,
      friction: 0.64,
      restitution: 0.08,
      weight: 5,
      color: "#f7a93b",
      chamfer: 7
    },
    {
      name: "apple",
      difficulty: "hard",
      shape: "circle",
      radius: 25,
      density: 0.0018,
      friction: 0.38,
      restitution: 0.3,
      weight: 4,
      color: "#ff5c5c"
    },
    {
      name: "ball",
      difficulty: "hard",
      shape: "circle",
      radius: 23,
      density: 0.0015,
      friction: 0.22,
      restitution: 0.38,
      weight: 3,
      color: "#66e0c2"
    },
    {
      name: "ruler",
      difficulty: "hard",
      shape: "rectangle",
      width: 166,
      height: 16,
      density: 0.0013,
      friction: 0.58,
      restitution: 0.07,
      weight: 4,
      color: "#f6f6d2",
      chamfer: 2
    },
    {
      name: "marker",
      difficulty: "hard",
      shape: "rectangle",
      width: 106,
      height: 20,
      density: 0.0014,
      friction: 0.56,
      restitution: 0.09,
      weight: 5,
      color: "#2dd4bf",
      chamfer: 10
    }
  ];

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function escapeHTML(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function readBest() {
    try {
      return Number.parseInt(window.localStorage.getItem(BEST_KEY) || "0", 10) || 0;
    } catch (error) {
      return 0;
    }
  }

  function writeBest(value) {
    try {
      window.localStorage.setItem(BEST_KEY, String(value));
    } catch (error) {
      // localStorage may be unavailable in some private or file contexts.
    }
  }

  function normalizeDeck(deck) {
    return deck
      .map((card, index) => ({
        index,
        term: card.term || card.question || card.front || card.prompt || "",
        answer: card.definition || card.answer || card.back || card.response || ""
      }))
      .filter((card) => card.term && card.answer);
  }

  function chooseWeightedItem() {
    const totalWeight = STACK_ITEMS.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * totalWeight;
    const picked = STACK_ITEMS.find((item) => {
      roll -= item.weight;
      return roll <= 0;
    }) || STACK_ITEMS[0];

    const awkwardAngle = picked.difficulty === "hard"
      ? (Math.random() - 0.5) * 0.18
      : (Math.random() - 0.5) * 0.06;

    return {
      ...picked,
      dropAngle: picked.shape === "circle" ? 0 : awkwardAngle
    };
  }

  function getItemSize(item) {
    if (item.shape === "circle") {
      return {
        width: item.radius * 2,
        height: item.radius * 2
      };
    }

    return {
      width: item.width,
      height: item.height
    };
  }

  function itemShapeStyle(item) {
    const size = getItemSize(item);
    return [
      `width: ${Math.max(24, Math.min(52, size.width * 0.45))}px`,
      `height: ${Math.max(18, Math.min(44, size.height * 0.7))}px`,
      `background: ${item.color}`,
      `border-radius: ${item.shape === "circle" ? "50%" : `${item.chamfer || 5}px`}`
    ].join("; ");
  }

  function create({ deck, panel, onProgress, onExit }) {
    const cards = normalizeDeck(deck);
    const state = {
      queue: [],
      cursor: 0,
      currentIndex: 0,
      choices: [],
      answerState: null,
      phase: "idle",
      feedback: "",
      pendingItem: null,
      placed: 0,
      streak: 0,
      best: readBest(),
      tokenPosition: null,
      tokenSize: null,
      drag: null,
      resultReason: ""
    };

    let physics = null;
    let shellReady = false;
    let elements = {};

    function ensureShell() {
      if (shellReady) return;

      panel.innerHTML = `
        <div class="stack-game">
          <section class="stack-panel" aria-label="Stack questions">
            <div class="stack-stats" data-stack-stats></div>
            <p class="stack-question" data-stack-question></p>
            <div class="stack-answer-grid" data-stack-answers></div>
            <p class="stack-feedback" data-stack-feedback></p>
            <div class="stack-preview empty" data-stack-preview>No item earned yet.</div>
            <div class="stack-controls">
              <button class="btn btn-yellow" type="button" data-stack-next hidden>Next question</button>
              <button class="btn" type="button" data-stack-restart>Restart Stack</button>
              <button class="btn btn-dark" type="button" data-stack-return>Return to normal study mode</button>
            </div>
          </section>
          <section class="stack-stage-card" aria-label="Physics stack">
            <div class="stack-stage-toolbar">
              <span>Stack platform</span>
              <span data-stack-stage-status>Answer correctly to place an item</span>
            </div>
            <div class="stack-stage" data-stack-stage>
              <div class="stack-drop-hint" aria-hidden="true"></div>
              <div class="stack-token-layer" data-stack-token-layer></div>
              <div class="stack-overlay" data-stack-overlay></div>
            </div>
          </section>
        </div>
      `;

      elements = {
        stats: panel.querySelector("[data-stack-stats]"),
        question: panel.querySelector("[data-stack-question]"),
        answers: panel.querySelector("[data-stack-answers]"),
        feedback: panel.querySelector("[data-stack-feedback]"),
        preview: panel.querySelector("[data-stack-preview]"),
        next: panel.querySelector("[data-stack-next]"),
        stage: panel.querySelector("[data-stack-stage]"),
        stageStatus: panel.querySelector("[data-stack-stage-status]"),
        tokenLayer: panel.querySelector("[data-stack-token-layer]"),
        overlay: panel.querySelector("[data-stack-overlay]")
      };

      panel.addEventListener("click", handlePanelClick);
      shellReady = true;
    }

    function ensurePhysics() {
      if (physics || state.phase === "blocked") return;

      if (!window.StudyBroPhysics?.available) {
        state.phase = "blocked";
        state.feedback = "Matter.js did not load, so Stack cannot start yet.";
        render();
        return;
      }

      physics = window.StudyBroPhysics.createStackWorld({
        container: elements.stage,
        onLose: handleLoss
      });
      physics.start();
    }

    function start() {
      ensureShell();

      if (cards.length < 4) {
        state.phase = "blocked";
        state.feedback = "Stack needs at least four cards so it can create one correct answer and three distractors.";
        render();
        return;
      }

      ensurePhysics();
      restart();
    }

    function resume() {
      ensureShell();
      ensurePhysics();
      if (state.phase !== "lost" && state.phase !== "won") {
        physics?.start();
      }
      render();
    }

    function pause() {
      physics?.stop();
    }

    function restart() {
      state.queue = shuffle(cards.map((_, index) => index));
      state.cursor = 0;
      state.currentIndex = state.queue[0] || 0;
      state.choices = [];
      state.answerState = null;
      state.phase = "question";
      state.feedback = "Answer correctly to earn a random stack item.";
      state.pendingItem = null;
      state.placed = 0;
      state.streak = 0;
      state.best = readBest();
      state.tokenPosition = null;
      state.tokenSize = null;
      state.resultReason = "";
      physics?.clearItems();
      physics?.start();
      prepareQuestion();
    }

    function prepareQuestion() {
      if (state.cursor >= state.queue.length) {
        state.queue = shuffle(cards.map((_, index) => index));
        state.cursor = 0;
      }

      state.currentIndex = state.queue[state.cursor];
      state.choices = buildChoices(state.currentIndex);
      state.answerState = null;
      state.phase = "question";
      state.feedback = "Answer correctly to earn a random stack item.";
      state.pendingItem = null;
      state.tokenPosition = null;
      state.tokenSize = null;
      render();
    }

    function buildChoices(currentIndex) {
      const current = cards[currentIndex];
      const distractors = shuffle(cards
        .map((card, index) => ({ text: card.answer, cardIndex: index }))
        .filter((choice) => choice.cardIndex !== currentIndex))
        .slice(0, 3);

      return shuffle([
        { text: current.answer, cardIndex: currentIndex },
        ...distractors
      ]);
    }

    function handlePanelClick(event) {
      const answerButton = event.target.closest("[data-stack-choice]");
      if (answerButton && panel.contains(answerButton)) {
        answerQuestion(Number(answerButton.dataset.stackChoice));
        return;
      }

      if (event.target.closest("[data-stack-next]")) {
        advanceQuestion();
        return;
      }

      if (event.target.closest("[data-stack-restart]")) {
        restart();
        return;
      }

      if (event.target.closest("[data-stack-return]")) {
        pause();
        if (typeof onExit === "function") onExit();
      }
    }

    function answerQuestion(choicePosition) {
      if (state.phase !== "question") return;

      const selected = state.choices[choicePosition];
      const correctPosition = state.choices.findIndex((choice) => choice.cardIndex === state.currentIndex);
      const isCorrect = selected?.cardIndex === state.currentIndex;

      state.answerState = {
        selected: choicePosition,
        correct: correctPosition
      };

      if (isCorrect) {
        state.streak += 1;
        state.pendingItem = chooseWeightedItem();
        state.phase = "placing";
        state.feedback = `Correct. Drag the ${state.pendingItem.name} into the stack area and release it.`;
      } else {
        state.streak = 0;
        state.phase = "review";
        state.feedback = `Correct answer: ${cards[state.currentIndex].answer}`;
      }

      render();
    }

    function advanceQuestion() {
      if (state.phase === "lost" || state.phase === "won") return;
      state.cursor += 1;
      prepareQuestion();
    }

    function finishPlacement(x, y) {
      if (state.phase !== "placing" || !state.pendingItem) return;

      physics?.dropItem(state.pendingItem, x, y);
      state.placed += 1;
      updateBest();
      state.pendingItem = null;
      state.tokenPosition = null;
      state.tokenSize = null;

      if (state.placed >= MAX_ITEMS) {
        state.phase = "won";
        state.resultReason = "You stacked 100 study items.";
        render();
        window.setTimeout(() => physics?.stop(), 350);
        return;
      }

      advanceQuestion();
    }

    function updateBest() {
      if (state.placed <= state.best) return;
      state.best = state.placed;
      writeBest(state.best);
    }

    function handleLoss(reason) {
      if (state.phase === "lost" || state.phase === "won") return;

      updateBest();
      state.phase = "lost";
      state.pendingItem = null;
      state.tokenPosition = null;
      state.resultReason = reason || "An item fell below the play area.";
      render();
      window.setTimeout(() => physics?.stop(), 250);
    }

    function render() {
      ensureShell();
      const progress = state.phase === "won" ? 100 : (state.placed / MAX_ITEMS) * 100;
      if (typeof onProgress === "function") onProgress(progress);

      renderStats();
      renderQuestion();
      renderAnswers();
      renderFeedback();
      renderPreview();
      renderOverlay();
      renderToken();
    }

    function renderStats() {
      elements.stats.innerHTML = `
        <span class="stat">Items ${state.placed} / ${MAX_ITEMS}</span>
        <span class="stat">Streak ${state.streak}</span>
        <span class="stat">Best ${state.best}</span>
      `;
    }

    function renderQuestion() {
      if (state.phase === "blocked") {
        elements.question.textContent = "Stack cannot start";
        elements.stageStatus.textContent = "Setup needed";
        return;
      }

      const card = cards[state.currentIndex];
      elements.question.textContent = card ? card.term : "Stack";

      if (state.phase === "placing") {
        elements.stageStatus.textContent = "Drag and release the earned item";
      } else if (state.phase === "lost") {
        elements.stageStatus.textContent = "Stack toppled";
      } else if (state.phase === "won") {
        elements.stageStatus.textContent = "100 items stacked";
      } else {
        elements.stageStatus.textContent = "Answer correctly to place an item";
      }
    }

    function renderAnswers() {
      const locked = state.phase !== "question";
      elements.next.hidden = state.phase !== "review";

      if (state.phase === "blocked") {
        elements.answers.innerHTML = "";
        return;
      }

      elements.answers.innerHTML = state.choices.map((choice, index) => {
        const classes = ["stack-answer"];
        if (state.answerState?.correct === index) classes.push("correct");
        if (state.answerState?.selected === index && state.answerState.correct !== index) classes.push("wrong");

        return `
          <button
            class="${classes.join(" ")}"
            type="button"
            data-stack-choice="${index}"
            ${locked ? "disabled" : ""}
          >
            ${escapeHTML(choice.text)}
          </button>
        `;
      }).join("");
    }

    function renderFeedback() {
      if (state.phase === "placing" && state.pendingItem) {
        elements.feedback.innerHTML = `<strong>Correct.</strong> Drag the ${escapeHTML(state.pendingItem.name)} into the stack area.`;
        return;
      }

      elements.feedback.textContent = state.feedback;
    }

    function renderPreview() {
      if (!state.pendingItem) {
        elements.preview.className = "stack-preview empty";
        elements.preview.textContent = state.phase === "won"
          ? "No more items needed."
          : "No item earned yet.";
        return;
      }

      const item = state.pendingItem;
      elements.preview.className = "stack-preview";
      elements.preview.innerHTML = `
        <div class="stack-preview-shape" style="${itemShapeStyle(item)}"></div>
        <div>
          <h3>${escapeHTML(item.name)}</h3>
          <p>${escapeHTML(item.difficulty)} · ${escapeHTML(item.shape)} · ${item.weight} weight</p>
        </div>
      `;
    }

    function renderOverlay() {
      if (state.phase !== "lost" && state.phase !== "won") {
        elements.overlay.classList.remove("active");
        elements.overlay.innerHTML = "";
        return;
      }

      const won = state.phase === "won";
      elements.overlay.classList.add("active");
      elements.overlay.innerHTML = `
        <div class="stack-end-state">
          <h2>${won ? "Stacked!" : "Toppled"}</h2>
          <p>${escapeHTML(state.resultReason)} Best run: ${state.best} / ${MAX_ITEMS}.</p>
          <div class="stack-end-actions">
            <button class="btn btn-yellow" type="button" data-stack-restart>Restart</button>
            <button class="btn btn-dark" type="button" data-stack-return>Study mode</button>
          </div>
        </div>
      `;
    }

    function renderToken() {
      elements.tokenLayer.innerHTML = "";
      if (state.phase !== "placing" || !state.pendingItem) return;

      const item = state.pendingItem;
      const size = getItemSize(item);
      const stageRect = elements.stage.getBoundingClientRect();

      if (!state.tokenPosition) {
        state.tokenPosition = {
          x: Math.max(12, (stageRect.width - size.width) / 2),
          y: 28
        };
      }
      state.tokenSize = size;

      const token = document.createElement("div");
      token.className = `stack-token ${item.shape === "circle" ? "circle" : ""}`;
      token.tabIndex = 0;
      token.setAttribute("role", "button");
      token.setAttribute("aria-label", `Drag ${item.name} into the stack`);
      token.style.width = `${size.width}px`;
      token.style.height = `${size.height}px`;
      token.style.background = item.color;
      token.style.borderRadius = item.shape === "circle" ? "50%" : `${item.chamfer || 7}px`;
      token.addEventListener("pointerdown", startDrag);
      token.addEventListener("keydown", handleTokenKeydown);
      elements.tokenLayer.append(token);
      applyTokenPosition(token);
    }

    function startDrag(event) {
      if (state.phase !== "placing") return;

      event.preventDefault();
      const token = event.currentTarget;
      const tokenRect = token.getBoundingClientRect();
      state.drag = {
        pointerId: event.pointerId,
        offsetX: event.clientX - tokenRect.left,
        offsetY: event.clientY - tokenRect.top
      };

      token.setPointerCapture(event.pointerId);
      token.classList.add("dragging");
      token.addEventListener("pointermove", moveDrag);
      token.addEventListener("pointerup", endDrag);
      token.addEventListener("pointercancel", cancelDrag);
    }

    function moveDrag(event) {
      if (!state.drag || event.pointerId !== state.drag.pointerId) return;

      const stageRect = elements.stage.getBoundingClientRect();
      moveTokenTo(
        event.clientX - stageRect.left - state.drag.offsetX,
        event.clientY - stageRect.top - state.drag.offsetY,
        event.currentTarget
      );
    }

    function endDrag(event) {
      if (!state.drag || event.pointerId !== state.drag.pointerId) return;

      const token = event.currentTarget;
      token.releasePointerCapture(event.pointerId);
      token.classList.remove("dragging");
      token.removeEventListener("pointermove", moveDrag);
      token.removeEventListener("pointerup", endDrag);
      token.removeEventListener("pointercancel", cancelDrag);
      state.drag = null;
      dropToken();
    }

    function cancelDrag(event) {
      const token = event.currentTarget;
      token.classList.remove("dragging");
      token.removeEventListener("pointermove", moveDrag);
      token.removeEventListener("pointerup", endDrag);
      token.removeEventListener("pointercancel", cancelDrag);
      state.drag = null;
      renderToken();
    }

    function handleTokenKeydown(event) {
      if (state.phase !== "placing") return;

      const step = event.shiftKey ? 22 : 8;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        moveTokenTo(state.tokenPosition.x - step, state.tokenPosition.y, event.currentTarget);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        moveTokenTo(state.tokenPosition.x + step, state.tokenPosition.y, event.currentTarget);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        moveTokenTo(state.tokenPosition.x, state.tokenPosition.y - step, event.currentTarget);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveTokenTo(state.tokenPosition.x, state.tokenPosition.y + step, event.currentTarget);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        dropToken();
      }
    }

    function moveTokenTo(x, y, token) {
      const stageRect = elements.stage.getBoundingClientRect();
      const size = state.tokenSize || getItemSize(state.pendingItem);
      state.tokenPosition = {
        x: Math.max(0, Math.min(stageRect.width - size.width, x)),
        y: Math.max(0, Math.min(stageRect.height - size.height, y))
      };

      applyTokenPosition(token);
    }

    function applyTokenPosition(token) {
      if (!token || !state.tokenPosition) return;
      token.style.transform = `translate(${state.tokenPosition.x}px, ${state.tokenPosition.y}px)`;
    }

    function dropToken() {
      if (!state.pendingItem || !state.tokenPosition) return;

      const size = state.tokenSize || getItemSize(state.pendingItem);
      const x = state.tokenPosition.x + size.width / 2;
      const y = state.tokenPosition.y + size.height / 2;
      finishPlacement(x, y);
    }

    return {
      start,
      resume,
      pause,
      restart
    };
  }

  window.StudyBroStack = {
    create,
    items: STACK_ITEMS
  };
}());
