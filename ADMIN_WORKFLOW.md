# Study Bro Private Deck Creation Workflow

Study Bro uses one public static website to display many study decks. Each deck is stored as a JSON file in the repository's `/decks` folder. Its share URL is recorded in a matching Markdown file under `/deck-links`.

The public website is a **deck viewer**, not a deck creator. Deck creation is intentionally private and controlled through Codex, Google Drive, and GitHub.

## Request a new deck

Place the source study guide in the Google Drive folder named:

```text
Study Bro Study Guides
```

Then give Codex this request:

```text
Make a Study Bro deck from [study guide name].
```

Example:

```text
Make a Study Bro deck from Organic Chemistry Exam 2.
```

## Expected Codex workflow

Codex should:

1. Search the `Study Bro Study Guides` Google Drive folder for the specified guide.
2. Confirm the exact source file. If several files are plausible matches, ask which one to use.
3. Read the study guide without modifying it.
4. Extract its important terms, definitions, formulas, processes, dates, people, and other testable concepts.
5. Create one concise card per concept, remove duplicate cards, and avoid adding unsupported information.
6. Generate a short lowercase filename from the deck title, such as:

   ```text
   organic-chemistry-exam-2.json
   ```

7. Save the file in `/decks`.
8. Validate the JSON syntax and confirm every card has a non-empty `term` and `definition`.
9. Confirm that the destination filename does not already exist.
10. Create `deck-links/FILENAME.md` containing the shareable Vercel URL, deck JSON path, and card count.
11. Add the deck and URL to the table in `deck-links/README.md`.
12. Confirm that the matching link record does not already exist.
13. Commit the new deck JSON, its link record, and the updated link index to the Study Bro GitHub repository with a clear message, such as:

    ```text
    Add Organic Chemistry Exam 2 study deck
    ```

14. Push the commit so the connected Vercel project deploys the new file.
15. Verify the JSON file and Study Bro URL are live, then return the same URL stored in the link record.

## Required JSON format

```json
{
  "title": "Deck Title",
  "cards": [
    {
      "term": "Term",
      "definition": "Definition"
    }
  ]
}
```

The deck must have a non-empty title and at least one card. Every card must contain both a non-empty `term` and a non-empty `definition`.

## Rules

- Do not overwrite an existing deck file unless I explicitly approve the overwrite.
- Do not overwrite an existing deck-link record unless I explicitly approve the overwrite.
- Validate every card before committing.
- Do not modify the main Study Bro app when creating a deck.
- Commit only the intended JSON deck file, its matching link record, and the link index update; preserve unrelated repository changes.
- Do not commit the private source study guide.
- Commit and push the deck and link records to GitHub.
- Return the verified Vercel URL after deployment.

## Shareable URL format

```text
https://study-bro-nu.vercel.app/?deck=decks/FILENAME.json
```

Example:

```text
https://study-bro-nu.vercel.app/?deck=decks/organic-chemistry-exam-2.json
```

All deck URLs use the same Study Bro website and Vercel project. Adding a deck creates another JSON file and another shareable URL; it does not create a separate website.

## Link registry

Every published deck should have a matching record:

```text
decks/organic-chemistry-exam-2.json
deck-links/organic-chemistry-exam-2.md
```

The full browsable list is stored in:

```text
deck-links/README.md
```
