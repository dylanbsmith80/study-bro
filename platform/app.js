(function () {
  "use strict";

  const config = window.STUDY_BRO_CONFIG || {};
  const configured = config.supabaseUrl && !config.supabaseUrl.startsWith("__") &&
    config.supabasePublishableKey && !config.supabasePublishableKey.startsWith("__");

  const el = (id) => document.getElementById(id);
  const state = {
    client: null,
    user: null,
    profile: null,
    library: [],
    currentDeck: null,
    cards: [],
    overrides: new Map(),
    hiddenCards: new Set(),
    authMode: "signin"
  };

  function setVisible(id) {
    ["configurationView", "authView", "appView"].forEach((view) => { el(view).hidden = view !== id; });
  }

  function showSection(id) {
    ["libraryView", "deckView", "adminView"].forEach((view) => { el(view).hidden = view !== id; });
  }

  function message(target, text, success = false) {
    const node = el(target);
    node.textContent = text;
    node.classList.toggle("success", success);
    node.hidden = !text;
  }

  let toastTimer;
  function toast(text) {
    clearTimeout(toastTimer);
    el("toast").textContent = text;
    el("toast").hidden = false;
    toastTimer = setTimeout(() => { el("toast").hidden = true; }, 3200);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
    })[character]);
  }

  function route(path, replace = false) {
    if (replace) history.replaceState({}, "", path);
    else history.pushState({}, "", path);
    renderRoute();
  }

  async function renderRoute() {
    if (!state.user) return;
    const path = location.pathname.replace(/\/+$/, "") || "/";
    if (path === "/admin") {
      if (state.profile?.role !== "admin") {
        route("/", true);
        return;
      }
      showSection("adminView");
      await loadAdmin();
      return;
    }
    const deckMatch = path.match(/^\/deck\/([0-9a-f-]+)$/i);
    if (deckMatch) {
      showSection("deckView");
      await loadDeck(deckMatch[1]);
      return;
    }
    showSection("libraryView");
    if (path !== "/") history.replaceState({}, "", "/");
    await loadLibrary();
  }

  async function loadProfile() {
    const { data, error } = await state.client.from("profiles").select("id,email,display_name,role").eq("id", state.user.id).single();
    if (error) throw error;
    state.profile = data;
    const email = data.email || state.user.email || "Account";
    el("accountEmail").textContent = email;
    el("accountInitial").textContent = email.charAt(0).toUpperCase();
    el("adminNav").hidden = data.role !== "admin";
  }

  async function enterApp(user) {
    state.user = user;
    setVisible("appView");
    try {
      await loadProfile();
      const returnTo = new URLSearchParams(location.search).get("returnTo");
      if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
        history.replaceState({}, "", returnTo);
      }
      await renderRoute();
    } catch (error) {
      toast(error.message || "Study Bro could not load your account.");
    }
  }

  function enterAuth() {
    state.user = null;
    state.profile = null;
    setVisible("authView");
  }

  async function loadLibrary() {
    const { data, error } = await state.client.rpc("get_my_library");
    if (error) throw error;
    state.library = data || [];
    el("libraryGrid").innerHTML = state.library.map((deck, index) => `
      <article class="deck-tile" tabindex="0" role="link" data-deck-id="${deck.id}">
        <div class="deck-meta"><span>Deck ${String(index + 1).padStart(2, "0")}</span><span>${deck.card_count} cards</span></div>
        <h2>${escapeHTML(deck.title)}</h2>
        <p>${escapeHTML(deck.description || "Ready to study and personalize.")}</p>
        <span class="open-arrow">Open deck →</span>
      </article>`).join("");
    el("emptyLibrary").hidden = state.library.length > 0;
    el("libraryGrid").querySelectorAll("[data-deck-id]").forEach((tile) => {
      const open = () => route(`/deck/${tile.dataset.deckId}`);
      tile.addEventListener("click", open);
      tile.addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") open(); });
    });
  }

  async function loadDeck(deckId) {
    el("cardList").innerHTML = "<div class=\"empty-state\"><p>Loading your deck…</p></div>";
    const [{ data: deck, error: deckError }, { data: cards, error: cardError }, { data: overrides, error: overrideError }, { data: hidden, error: hiddenError }] = await Promise.all([
      state.client.from("decks").select("id,slug,title,description,updated_at").eq("id", deckId).single(),
      state.client.from("cards").select("id,position,term,definition,image_path,image_alt,revision").eq("deck_id", deckId).order("position"),
      state.client.from("card_overrides").select("card_id,custom_term,custom_definition,base_term,base_definition,base_revision,updated_at").eq("user_id", state.user.id),
      state.client.from("hidden_cards").select("card_id").eq("user_id", state.user.id)
    ]);
    if (deckError) throw deckError;
    if (cardError) throw cardError;
    if (overrideError) throw overrideError;
    if (hiddenError) throw hiddenError;
    state.currentDeck = deck;
    state.cards = cards || [];
    state.overrides = new Map((overrides || []).map((item) => [item.card_id, item]));
    state.hiddenCards = new Set((hidden || []).map((item) => item.card_id));
    el("deckTitle").textContent = deck.title;
    el("deckDescription").textContent = deck.description || "Your private, editable copy.";
    el("studyDeckButton").href = `/player.html?id=${deck.id}`;
    el("cardSearch").value = "";
    renderCards();
  }

  function effectiveCard(card) {
    const override = state.overrides.get(card.id);
    return {
      ...card,
      effectiveTerm: override?.custom_term ?? card.term,
      effectiveDefinition: override?.custom_definition ?? card.definition,
      personalized: Boolean(override),
      masterUpdated: Boolean(override && override.base_revision < card.revision),
      hidden: state.hiddenCards.has(card.id)
    };
  }

  function renderCards() {
    const query = el("cardSearch").value.trim().toLowerCase();
    const cards = state.cards.map(effectiveCard).filter((card) => !query || `${card.effectiveTerm} ${card.effectiveDefinition}`.toLowerCase().includes(query));
    el("deckCount").textContent = `${state.cards.length} cards`;
    el("cardList").innerHTML = cards.map((card, index) => `
      <article class="study-card-row ${card.hidden ? "hidden-card" : ""}">
        <span class="card-position">${String(index + 1).padStart(2, "0")}</span>
        <div class="card-term">${escapeHTML(card.effectiveTerm)}${card.personalized ? "<br><span class=\"personal-chip\">Personal</span>" : ""}${card.masterUpdated ? "<span class=\"update-chip\">Master updated</span>" : ""}</div>
        <div class="card-definition">${escapeHTML(card.effectiveDefinition)}</div>
        <div class="card-actions">
          <button type="button" data-edit="${card.id}">Edit mine</button>
          ${state.profile?.role === "admin" ? `<button type="button" data-master-edit="${card.id}">Edit master</button>` : ""}
          <button type="button" data-hide="${card.id}">${card.hidden ? "Restore" : "Hide"}</button>
        </div>
      </article>`).join("") || "<div class=\"empty-state\"><p>No cards match that search.</p></div>";
    el("cardList").querySelectorAll("[data-edit]").forEach((button) => button.addEventListener("click", () => openEdit(button.dataset.edit, "personal")));
    el("cardList").querySelectorAll("[data-master-edit]").forEach((button) => button.addEventListener("click", () => openEdit(button.dataset.masterEdit, "master")));
    el("cardList").querySelectorAll("[data-hide]").forEach((button) => button.addEventListener("click", () => toggleHidden(button.dataset.hide)));
  }

  function openEdit(cardId, mode) {
    const card = state.cards.find((item) => item.id === cardId);
    const override = state.overrides.get(cardId);
    el("editCardId").value = cardId;
    el("editMode").value = mode;
    el("editEyebrow").textContent = mode === "master" ? "Admin · master edit" : "Personal edit";
    el("editTitle").textContent = mode === "master" ? "Update the master card" : "Make this card yours";
    el("originalTerm").textContent = card.term;
    el("originalDefinition").textContent = card.definition;
    el("editTerm").value = mode === "master" ? card.term : (override?.custom_term ?? card.term);
    el("editDefinition").value = mode === "master" ? card.definition : (override?.custom_definition ?? card.definition);
    el("masterUpdateNote").hidden = !(mode === "personal" && override && override.base_revision < card.revision);
    el("resetCardButton").hidden = mode === "master" || !override;
    el("editDialog").showModal();
  }

  async function saveEdit(event) {
    event.preventDefault();
    const cardId = el("editCardId").value;
    const mode = el("editMode").value;
    const card = state.cards.find((item) => item.id === cardId);
    const term = el("editTerm").value.trim();
    const definition = el("editDefinition").value.trim();
    if (!term || !definition) return;
    if (mode === "master") {
      const { error } = await state.client.from("cards").update({ term, definition }).eq("id", cardId);
      if (error) return toast(error.message);
      el("editDialog").close();
      toast("Master card updated. Untouched customer cards will receive it.");
      await loadDeck(state.currentDeck.id);
      return;
    }
    const payload = {
      user_id: state.user.id,
      card_id: cardId,
      custom_term: term === card.term ? null : term,
      custom_definition: definition === card.definition ? null : definition,
      base_term: card.term,
      base_definition: card.definition,
      base_revision: card.revision
    };
    if (!payload.custom_term && !payload.custom_definition) {
      await resetCard(cardId);
      return;
    }
    const { error } = await state.client.from("card_overrides").upsert(payload, { onConflict: "user_id,card_id" });
    if (error) return toast(error.message);
    el("editDialog").close();
    toast("Your private edit was saved.");
    await loadDeck(state.currentDeck.id);
  }

  async function resetCard(cardId = el("editCardId").value) {
    const { error } = await state.client.from("card_overrides").delete().eq("user_id", state.user.id).eq("card_id", cardId);
    if (error) return toast(error.message);
    el("editDialog").close();
    toast("Card reset to the latest master version.");
    await loadDeck(state.currentDeck.id);
  }

  async function toggleHidden(cardId) {
    if (state.hiddenCards.has(cardId)) {
      const { error } = await state.client.from("hidden_cards").delete().eq("user_id", state.user.id).eq("card_id", cardId);
      if (error) return toast(error.message);
    } else {
      const { error } = await state.client.from("hidden_cards").insert({ user_id: state.user.id, card_id: cardId });
      if (error) return toast(error.message);
    }
    await loadDeck(state.currentDeck.id);
  }

  async function loadAdmin() {
    const { data, error } = await state.client.from("decks").select("id,title,slug,status,updated_at").order("updated_at", { ascending: false });
    if (error) throw error;
    const decks = data || [];
    el("grantDeck").innerHTML = '<option value="">Choose a deck</option>' + decks.map((deck) => `<option value="${deck.id}">${escapeHTML(deck.title)}</option>`).join("");
    el("adminDeckList").innerHTML = decks.map((deck) => `<a class="admin-deck" href="/deck/${deck.id}" data-route><strong>${escapeHTML(deck.title)}</strong><span>${escapeHTML(deck.status)} →</span></a>`).join("") || "<p class=\"muted\">No decks published yet.</p>";
    bindRouteLinks(el("adminDeckList"));
  }

  function validateDeckPayload(payload) {
    if (!payload || !Array.isArray(payload.cards) || !payload.cards.length) throw new Error("The JSON needs a non-empty cards array.");
    payload.cards.forEach((card, index) => {
      if (!card || typeof card.term !== "string" || !card.term.trim() || typeof card.definition !== "string" || !card.definition.trim()) {
        throw new Error(`Card ${index + 1} needs a term and definition.`);
      }
    });
  }

  async function publishDeck(event) {
    event.preventDefault();
    message("uploadMessage", "");
    try {
      const parsed = JSON.parse(el("uploadJson").value);
      validateDeckPayload(parsed);
      const payload = {
        title: el("uploadTitle").value.trim() || parsed.title,
        slug: el("uploadSlug").value.trim(),
        description: el("uploadDescription").value.trim(),
        cards: parsed.cards
      };
      const { data, error } = await state.client.rpc("admin_import_deck", { p_payload: payload });
      if (error) throw error;
      const imageResult = await uploadDeckImages(data);
      message("uploadMessage", `Published ${payload.cards.length} cards${imageResult ? ` and ${imageResult} protected images` : ""} successfully.`, true);
      event.target.reset();
      await loadAdmin();
      toast("Deck published.");
      if (data) route(`/deck/${data}`);
    } catch (error) {
      message("uploadMessage", error.message || "That deck could not be published.");
    }
  }

  async function uploadDeckImages(deckId) {
    const files = Array.from(el("uploadImages").files || []);
    if (!files.length) return 0;
    const { data: cards, error: cardError } = await state.client.from("cards").select("id,image_path").eq("deck_id", deckId);
    if (cardError) throw cardError;
    let uploaded = 0;
    for (const file of files) {
      const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
      const objectPath = `${deckId}/${safeName}`;
      const { error: uploadError } = await state.client.storage.from("deck-assets").upload(objectPath, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const matchingCards = (cards || []).filter((card) => card.image_path && card.image_path.split("/").pop().toLowerCase() === file.name.toLowerCase());
      for (const card of matchingCards) {
        const { error: updateError } = await state.client.from("cards").update({ image_path: objectPath }).eq("id", card.id);
        if (updateError) throw updateError;
      }
      uploaded += 1;
    }
    return uploaded;
  }

  async function grantAccess(event) {
    event.preventDefault();
    message("grantMessage", "");
    const { error } = await state.client.rpc("admin_grant_access", {
      p_email: el("grantEmail").value.trim(), p_deck_id: el("grantDeck").value
    });
    if (error) return message("grantMessage", error.message);
    message("grantMessage", "Access granted. The deck is now in the customer’s library.", true);
    el("grantEmail").value = "";
  }

  function bindRouteLinks(root = document) {
    root.querySelectorAll("[data-route]").forEach((link) => {
      if (link.dataset.bound) return;
      link.dataset.bound = "true";
      link.addEventListener("click", (event) => { event.preventDefault(); route(new URL(link.href).pathname); });
    });
  }

  function bindEvents() {
    bindRouteLinks();
    window.addEventListener("popstate", renderRoute);
    el("backToLibrary").addEventListener("click", () => route("/"));
    el("cardSearch").addEventListener("input", renderCards);
    el("closeDialog").addEventListener("click", () => el("editDialog").close());
    el("editForm").addEventListener("submit", saveEdit);
    el("resetCardButton").addEventListener("click", () => resetCard());
    el("deckUploadForm").addEventListener("submit", publishDeck);
    el("grantForm").addEventListener("submit", grantAccess);
    el("uploadFile").addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const text = await file.text();
      el("uploadJson").value = text;
      try {
        const deck = JSON.parse(text);
        if (deck.title) {
          el("uploadTitle").value = deck.title;
          el("uploadSlug").value = deck.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
        }
        message("uploadMessage", `${deck.cards?.length || 0} cards loaded and ready to validate.`, true);
      } catch (_) { message("uploadMessage", "That file is not valid JSON."); }
    });
    el("signOutButton").addEventListener("click", () => state.client.auth.signOut());
    el("authToggle").addEventListener("click", () => {
      state.authMode = state.authMode === "signin" ? "signup" : "signin";
      const signup = state.authMode === "signup";
      el("authTitle").textContent = signup ? "Create your account" : "Sign in to your decks";
      el("authSubtitle").textContent = signup ? "Your assigned decks and personal edits will live here." : "Use the email connected to your Study Bro account.";
      el("authSubmit").textContent = signup ? "Create account" : "Sign in";
      el("authToggle").textContent = signup ? "Already have an account? Sign in" : "New here? Create an account";
      el("authPassword").autocomplete = signup ? "new-password" : "current-password";
      message("authMessage", "");
    });
    el("authForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      message("authMessage", "");
      const credentials = { email: el("authEmail").value.trim(), password: el("authPassword").value };
      el("authSubmit").disabled = true;
      const result = state.authMode === "signup"
        ? await state.client.auth.signUp({ ...credentials, options: { emailRedirectTo: location.origin } })
        : await state.client.auth.signInWithPassword(credentials);
      el("authSubmit").disabled = false;
      if (result.error) return message("authMessage", result.error.message);
      if (state.authMode === "signup" && !result.data.session) message("authMessage", "Check your email to confirm your account, then sign in.", true);
    });
    el("forgotPassword").addEventListener("click", async () => {
      const email = el("authEmail").value.trim();
      if (!email) return message("authMessage", "Enter your email first, then choose password reset.");
      const { error } = await state.client.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
      message("authMessage", error ? error.message : "Password reset email sent.", !error);
    });
  }

  async function init() {
    if (!configured || !window.supabase) {
      setVisible("configurationView");
      return;
    }
    state.client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey);
    bindEvents();
    const { data: { session } } = await state.client.auth.getSession();
    if (session?.user) await enterApp(session.user);
    else enterAuth();
    state.client.auth.onAuthStateChange((event, sessionState) => {
      if (event === "SIGNED_OUT" || !sessionState) enterAuth();
      else if (event === "SIGNED_IN" && sessionState.user?.id !== state.user?.id) enterApp(sessionState.user);
    });
  }

  init();
})();
