# Study Bro Private Deck Creation Workflow

Study Bro uses one public static website to display many study decks. Each deck is stored as a JSON file in the repository's `/decks` folder.

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
10. Commit only the new deck JSON file to the Study Bro GitHub repository with a clear message, such as:

    ```text
    Add Organic Chemistry Exam 2 study deck
    ```

11. Push the commit so the connected Vercel project deploys the new file.
12. Verify the JSON file is live and return the shareable Study Bro URL.

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
- Validate every card before committing.
- Do not modify the main Study Bro app when creating a deck.
- Commit only the intended JSON deck file; preserve unrelated repository changes.
- Do not commit the private source study guide.
- Commit and push the JSON file to GitHub.
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
