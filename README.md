# Study Bro

Study Bro is a Quizlet-style study app built as a single, self-contained HTML file.

It includes three study modes:

- Flashcards for reviewing terms and definitions
- Learn for multiple-choice practice
- Match for matching terms with their definitions

Open `index.html` in a web browser to use the built-in sample deck.

## Add a deck

Create a JSON file in the `decks` folder using this format:

```json
{
  "title": "Biology Chapter 1",
  "cards": [
    {
      "term": "Osmosis",
      "definition": "The movement of water across a semipermeable membrane."
    }
  ]
}
```

Each deck needs a title and at least one card. Every card must have a term and definition.

## Open or share a deck

Add the relative JSON file path to the `deck` query parameter:

```text
https://your-site.example/?deck=decks/biology-chapter-1.json
```

For the included sample deck:

```text
https://your-site.example/?deck=decks/sample-deck.json
```

Commit and push new JSON files to GitHub before sharing their links. Vercel will automatically deploy files pushed to the connected repository.
