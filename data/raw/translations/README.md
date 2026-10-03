# D3 — Quran translations (English · Urdu · Bengali)

**Required source (reference p.3):** «ترجمات معتمدة لكل لغة مستخدمة (طبعة مجمع الملك فهد
أو ترجماته أو الواردة في quranpedia.net)» — i.e. a translation **published by the King Fahd
Complex**, or one **listed on quranpedia.net**.

The *edition* is what must be approved, not the website the file was downloaded from.
Your team chooses **one edition per language** and records why it qualifies.

## Files to provide — same structure in `en/`, `ur/`, `bn/`

```
translations/<lang>/
├── original/                         ← the file(s) exactly as downloaded
├── quran_<lang>_<edition-slug>.csv   ← optional if the original is structured
└── edition.json                      ← required
```

Example names: `quran_en_hilali-khan.csv`, `quran_ur_junagarhi.csv`, `quran_bn_zakaria.csv`
(these are examples of the naming pattern, not a decision on which edition to use).

### `quran_<lang>_<edition-slug>.csv` — one row per ayah, exactly 6,236 rows

| Column | Required | Type | Rules |
|---|---|---|---|
| `surah` | ✅ | integer | 1–114 — must match `quran/` |
| `ayah` | ✅ | integer | must match `quran/` |
| `text` | ✅ | text | exactly as published, including brackets `[ ]` and parentheses |
| `footnotes` | optional | text | footnotes for that ayah, as published |
| `note` | optional | text | only for structural facts, e.g. `merged_with_next` when the edition translates two ayahs together |

Header only:
```csv
surah,ayah,text,footnotes,note
```

### `edition.json` — required

```json
{
  "slug": "",
  "language": "en | ur | bn",
  "name": "",
  "translator": "",
  "publisher": "",
  "approval_basis": "published_by_kfgqpc | listed_on_quranpedia",
  "approval_evidence": "URL or citation proving the basis above",
  "source_url": "",
  "original_filename": "",
  "edition_or_version": "",
  "downloaded_on": "YYYY-MM-DD",
  "downloaded_by": "",
  "licence_terms": ""
}
```

## Automated checks before import

- 6,236 rows whose `(surah, ayah)` keys match the Arabic text exactly
- no empty `text` unless `note` explains it (e.g. merged ayahs)
- UTF-8 valid; Urdu/Bengali text checked to be in the expected script
- SHA-256 of the original recorded in `documents`

## Maps to (no schema change)

`sources` → `translation_editions` (1 per language, `kind = 'quran'`) →
`quran_translations` (6,236 per language = 18,708 total).
An edition is set to `approval_status = 'approved'` **only** when `approval_basis` is one of
the two values above and a reviewer confirms the evidence; otherwise it stays
`pending_review` and is never shown to users.
