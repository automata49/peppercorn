## 2026-10-26 JSON report extension

New Instinct reports can bypass PDF entirely: see [content contract](INSTINCT_CONTENT_CONTRACT.md). Structured sections, factual summaries, tables, source links and licensed images reuse the same owner-RLS table and read-only endpoint. Legacy PDFs retain their original reader. Market Signal is the current report location; historical Today/Journal placement below is superseded.

# Private PDF reports

User direction (2026-10-15): PDFs saved in the registered Drive folder feed a short summary in expanded Today and durable full reports in Journal. Preserve article titles/links-only HS Academy and hidden Gemini presentation; existing Gemini generation remains independent.

## Data path

The connected Drive importer checks file ID and modified time against `private_source_reports`. It downloads only new/changed PDFs through the authenticated connector, extracts text and safe source links, and renders original page slices including vector charts. The source PDF remains in Drive. `analysis.drive_pdf_reports` writes temporary payload/SQL outside this public repository. Grounded summaries retain observation times, stale-data limitations and uncertainty; no fresh investment signal or fabricated number is added.

Summary contract (2026-10-17): **Do not describe what a report intends to analyze or which direction it takes.** Today's research bullets extract up to five factual passages from PDF text, grouped as **[시장] / [산업] / [종목]** when those topics are present. Prioritize actual economic/price changes, industry supply/demand and company results with units and dates as written; preserve uncertainty and historical time references in quoted passages. Never fabricate category coverage or rewrite source figures. A provided summary file acts only as an excerpt-ranking hint, not as an unverified display override. If there is no qualified fact, show a source-check notice instead of introductory/marketing prose. Existing stored summaries require re-import of the same Drive IDs to receive the revised text; the unchanged-file importer does not automatically backfill them. Textless scans stop for OCR rather than publishing an empty summary.

The trusted import upserts `(user_id, drive_file_id)`; older source timestamps cannot overwrite newer snapshots, unchanged payloads do not rewrite, corrected derived summaries/pages/links can update. A new Drive file ID is a separate report. Removed source files do not automatically delete archived reports.

`source-reports` verifies the bearer with Auth and forwards that bearer to PostgREST. The table grants authenticated users SELECT only, restricted by owner RLS; anonymous/browser writes are denied. No service key is in the frontend, and no private payload, rendered image, email or account ID is committed here. The importer uses the user's connected private database tool, not a public write endpoint.

The app keeps account-scoped data only in memory, fetches the latest 100 report headers, loads full text/images only when opened, and refreshes visible sessions every five minutes. Account changes abort requests and immediately hide previous results. Journal's imported report shelf is separate from editable device notebooks and their backups; it never rewrites personal notes. Displayed PDF modification time is distinct from market observation time inside the report.

## Verification

`python -m pip install -r analysis/requirements-drive-pdf.txt`

`python -m unittest analysis.test_drive_pdf_reports`

`node supabase/tests/source_reports.verify.mjs`

`npx playwright test tests/source-reports.spec.ts`

Production acceptance also checks owner/other-account RLS, duplicate re-import, anonymous 401, and existing four-screen regressions. A fixture UI test is not proof of a real user's Google or Folio login round trip.
