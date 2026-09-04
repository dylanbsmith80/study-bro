import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const decksRoot = path.join(repositoryRoot, "decks");
const assetsRoot = path.join(repositoryRoot, "deck-assets");
const validateOnly = process.argv.includes("--validate-only");
const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!validateOnly && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

function contentType(filePath) {
  return ({
    ".avif": "image/avif",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp"
  })[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function deckSlug(filePath, deck) {
  return String(deck.slug || path.basename(filePath, ".json")).trim().toLowerCase();
}

async function loadDecks() {
  const files = (await walk(decksRoot)).filter((file) => file.endsWith(".json")).sort();
  const slugs = new Set();
  let imageCount = 0;
  const decks = [];

  for (const filePath of files) {
    const deck = JSON.parse(await readFile(filePath, "utf8"));
    const slug = deckSlug(filePath, deck);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`${filePath}: invalid slug "${slug}".`);
    if (slugs.has(slug)) throw new Error(`${filePath}: duplicate deck slug "${slug}".`);
    slugs.add(slug);
    if (typeof deck.title !== "string" || !deck.title.trim()) throw new Error(`${filePath}: title is required.`);
    if (!Array.isArray(deck.cards) || !deck.cards.length) throw new Error(`${filePath}: cards must be a non-empty array.`);

    const imageNames = new Set();
    for (const [index, card] of deck.cards.entries()) {
      if (typeof card?.term !== "string" || !card.term.trim() || typeof card.definition !== "string" || !card.definition.trim()) {
        throw new Error(`${filePath}: card ${index + 1} needs a term and definition.`);
      }
      if (!card.image) continue;
      if (typeof card.image !== "string") throw new Error(`${filePath}: card ${index + 1} has an invalid image path.`);
      if (!/^https?:\/\//i.test(card.image)) {
        const relativePath = card.image.replace(/^\/+/, "");
        const resolvedPath = path.resolve(repositoryRoot, relativePath);
        if (!resolvedPath.startsWith(`${assetsRoot}${path.sep}`)) {
          throw new Error(`${filePath}: card ${index + 1} image must be under deck-assets/.`);
        }
        await stat(resolvedPath);
        const imageName = path.basename(resolvedPath).toLowerCase();
        if (imageNames.has(imageName)) throw new Error(`${filePath}: duplicate image filename "${imageName}".`);
        imageNames.add(imageName);
        imageCount += 1;
      }
      if (typeof card.imageAlt !== "string" || !card.imageAlt.trim()) {
        throw new Error(`${filePath}: card ${index + 1} needs imageAlt text.`);
      }
    }

    decks.push({ filePath, slug, deck });
  }

  return { decks, imageCount };
}

async function rest(table, { method = "GET", query = {}, body, prefer = "" } = {}) {
  const target = new URL(`${supabaseUrl}/rest/v1/${table}`);
  for (const [key, value] of Object.entries(query)) target.searchParams.set(key, value);
  const response = await fetch(target, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${table} failed (${response.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function ensureDeck(slug, deck) {
  const matches = await rest("decks", {
    query: { select: "id,slug,title,description,status", slug: `eq.${slug}`, limit: "1" }
  });
  const desired = {
    slug,
    title: deck.title.trim(),
    description: typeof deck.description === "string" ? deck.description.trim() : "",
    status: "published"
  };
  if (!matches.length) {
    const created = await rest("decks", { method: "POST", body: desired, prefer: "return=representation" });
    return created[0];
  }
  const current = matches[0];
  if (current.title !== desired.title || current.description !== desired.description || current.status !== desired.status) {
    await rest("decks", { method: "PATCH", query: { id: `eq.${current.id}` }, body: desired });
  }
  return { ...current, ...desired };
}

async function uploadImage(deckId, imagePath) {
  if (/^https?:\/\//i.test(imagePath)) return imagePath;
  const relativePath = imagePath.replace(/^\/+/, "");
  const localPath = path.resolve(repositoryRoot, relativePath);
  const objectPath = `${deckId}/${path.basename(localPath).toLowerCase()}`;
  const encodedPath = objectPath.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${supabaseUrl}/storage/v1/object/deck-assets/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": contentType(localPath),
      "x-upsert": "true"
    },
    body: await readFile(localPath)
  });
  if (!response.ok) throw new Error(`Image upload failed for ${relativePath} (${response.status}): ${await response.text()}`);
  return objectPath;
}

function normalizeTerm(term) {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

function sourceKey(slug, card, occurrence) {
  const explicitId = card.id || card.cardId;
  const identity = explicitId ? `id:${explicitId}` : `term:${normalizeTerm(card.term)}:${occurrence}`;
  return createHash("sha256").update(`${slug}\n${identity}`).digest("hex").slice(0, 32);
}

async function syncCards(deckId, slug, deck) {
  const existing = await rest("cards", {
    query: {
      select: "id,position,term,definition,image_path,image_alt,source_key,source_active",
      deck_id: `eq.${deckId}`,
      order: "position.asc"
    }
  });
  existing.forEach((card) => { card.originalPosition = card.position; });
  const usedIds = new Set();
  const uploaded = new Map();
  const termOccurrences = new Map();
  const desiredCards = deck.cards.map((card, position) => {
    const normalized = normalizeTerm(card.term);
    const occurrence = (termOccurrences.get(normalized) || 0) + 1;
    termOccurrences.set(normalized, occurrence);
    return { source: card, position, key: sourceKey(slug, card, occurrence), normalized };
  });

  // Move existing rows out of the active position range first. This lets a
  // reorder reuse the same card IDs without colliding with the unique index.
  if (existing.length) {
    const maxPosition = Math.max(...existing.map((card) => card.position));
    const stagingBase = maxPosition + existing.length + 1000;
    for (const [index, card] of existing.entries()) {
      await rest("cards", {
        method: "PATCH",
        query: { id: `eq.${card.id}` },
        body: { position: stagingBase + index }
      });
    }
  }

  for (const { source, position, key, normalized } of desiredCards) {
    let imagePath = source.image || null;
    if (imagePath && !/^https?:\/\//i.test(imagePath)) {
      if (!uploaded.has(imagePath)) uploaded.set(imagePath, await uploadImage(deckId, imagePath));
      imagePath = uploaded.get(imagePath);
    }
    const desired = {
      deck_id: deckId,
      position,
      term: source.term.trim(),
      definition: source.definition.trim(),
      image_path: imagePath,
      image_alt: typeof source.imageAlt === "string" && source.imageAlt.trim() ? source.imageAlt.trim() : null,
      source_key: key,
      source_active: true
    };
    const available = (card) => !usedIds.has(card.id);
    const current = existing.find((card) => available(card) && card.source_key === key)
      || existing.find((card) => available(card) && card.source_active && normalizeTerm(card.term) === normalized)
      || existing.find((card) => available(card) && card.source_active && card.originalPosition === position)
      || existing.find((card) => available(card) && normalizeTerm(card.term) === normalized);
    if (!current) {
      await rest("cards", { method: "POST", body: desired });
      continue;
    }
    usedIds.add(current.id);
    await rest("cards", { method: "PATCH", query: { id: `eq.${current.id}` }, body: desired });
  }

  for (const archived of existing.filter((card) => !usedIds.has(card.id) && card.source_active)) {
    await rest("cards", { method: "PATCH", query: { id: `eq.${archived.id}` }, body: { source_active: false } });
  }
}

const { decks, imageCount } = await loadDecks();
const cardCount = decks.reduce((sum, item) => sum + item.deck.cards.length, 0);
if (validateOnly) {
  console.log(`Validated ${decks.length} decks, ${cardCount} cards, and ${imageCount} local images.`);
  process.exit(0);
}

for (const { slug, deck } of decks) {
  const databaseDeck = await ensureDeck(slug, deck);
  await syncCards(databaseDeck.id, slug, deck);
  console.log(`Synced ${slug}: ${deck.cards.length} cards.`);
}
console.log(`Study Bro sync complete: ${decks.length} decks and ${cardCount} cards.`);
