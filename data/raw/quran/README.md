# D2 — Quran Arabic text

**Required source (reference p.3):** «النص القرآني بالرسم والنص المعتمد» —
the **King Fahd Glorious Quran Printing Complex** (مجمع الملك فهد لطباعة المصحف الشريف)
edition, or the text published on **quranpedia.net**. Riwayah: **Hafs ʿan ʿAsim**.

## Files to provide

```
quran/
├── original/            ← the file(s) exactly as downloaded (any format)
├── quran_uthmani.csv    ← optional if the original is already structured (see below)
├── surahs.csv           ← optional if the original already contains surah names/counts
└── SOURCE.md            ← required
```

If the original file is already structured (CSV, XLSX, JSON, XML, SQL) you can stop after
`original/` + `SOURCE.md`; the conversion script will produce the two CSVs.

### `quran_uthmani.csv` — one row per ayah, exactly 6,236 rows

| Column | Required | Type | Rules |
|---|---|---|---|
| `surah` | ✅ | integer | 1–114 |
| `ayah` | ✅ | integer | 1…ayah_count of that surah, no gaps |
| `text_uthmani` | ✅ | text | Uthmani script **exactly as in the source**: no trimming of marks, no normalisation, no added ayah-number glyphs (۝١) |
| `text_simple` | optional | text | plain (imla'i) script, **only if published by the same source** |
| `juz` | optional | integer | 1–30 |
| `page` | optional | integer | Madinah Mushaf page number |

Example of the header only (no content):
```csv
surah,ayah,text_uthmani,text_simple,juz,page
```

### `surahs.csv` — exactly 114 rows

| Column | Required | Type | Rules |
|---|---|---|---|
| `number` | ✅ | integer | 1–114 |
| `name_ar` | ✅ | text | as in the source |
| `name_transliteration` | optional | text | e.g. Al-Baqarah |
| `name_en` | optional | text | |
| `revelation_place` | optional | text | `makkah` or `madinah` |
| `ayah_count` | ✅ | integer | must equal the number of rows for that surah |

### `SOURCE.md` — required

```
Source name:       (e.g. King Fahd Glorious Quran Printing Complex)
Publisher:
Edition / version: (version number of the text file, e.g. as printed in the file)
Riwayah:           Hafs ʿan ʿAsim
Original URL:      (page the file was downloaded from)
Original filename:
Downloaded on:     (date)
Downloaded by:
Licence / terms:   (copy the usage terms or link to them)
```

## Automated checks before import (nothing is imported if any fails)

- 6,236 ayahs and 114 surahs; `(surah, ayah)` unique and continuous; Σ ayah_count = 6,236
- per-surah counts match the standard Hafs count (e.g. Al-Baqarah = 286)
- no empty `text_uthmani`; UTF-8 valid; SHA-256 of the original file recorded in `documents`
- **Basmala check:** in Hafs, the basmala is ayah 1 of Al-Fatiha only. If the file prefixes
  the basmala to ayah 1 of other surahs, the import stops and reports it (we do not strip it
  silently — a reviewer decides).
- text is stored byte-for-byte; the database derives a separate normalised column for search
- display check: render a sample in the UI font (Amiri Quran). Some Complex text files are
  encoded for the Complex's own font (KFGQPC Uthmanic Hafs); if marks render wrongly, we
  bundle that font instead of altering the text.

## Maps to (no schema change)

`sources` → `documents` (1 row, checksum) → `quran_surahs` (114) → `quran_ayahs` (6,236)
All rows start unpublished (`documents.publication_status = 'draft'`) until a reviewer approves.
