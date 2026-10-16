# Decision review

The Journal is the source archive. Journey's 재판단 tab is an action queue, not a second notebook gallery. One row per original investment notebook ID displays the current judgement and next schedule/condition. Distinct notebooks for the same ticker are not silently merged or deleted.

## Flow

1. Read the last judgement once; record newly checked evidence.
2. Maintain it without retyping, revise it with a genuinely different sentence, or close the review.
3. Set a next date or a condition to check. Lessons and next actions are optional.

Text formatting, photos and vector ink remain in an optional evidence notebook. Original notebooks and connected Thesis/trading records stay accessible. First/current judgement comparison and dated history are disclosures rather than repeated primary content.

## State and storage

- Due/no initial review: needs checking.
- Future date or a condition-only schedule: planned. Conditions are user checked; no automatic trigger detection is claimed.
- Legacy reviewed entry with no active schedule: completed.
- Latest outcome close: closed regardless of legacy dates, with explicit reopen action.

A review optionally stores `judgement`, `previousJudgement`, `trigger` and `nextReviewDate` in the existing `reflections` array. Root notebook hypothesis/body/ink/photos are not rewritten. Next review uses the latest explicit judgement; later legacy reviews without that field do not revert it. Timestamp instants, including ISO offsets, determine latest history. Root reviewDate is the current schedule; snapshots and individual nextReviewDate retain older schedules. Version-1 backup parsing and existing owner-account cloud JSON preserve additions without schema migration.

Today uses the same active judgement and due/closed state. Queue priority is state, next date (missing dates sort last), latest update, then ID. Calendar filters use schedule or latest review date, not just the original journal date. Search includes latest evidence, judgement, condition and notes. Sources remain linked references rather than duplicated primary cards. Existing account conflict recovery remains authoritative; no automatic deletion/deduplication is introduced.

## Checks

`tests/decision-review.spec.ts` covers timezone-aware close/reopen, condition waiting, fallback from legacy reviews, priority, metadata backup round trips and a real revise → close → reopen UI chain. Existing journal, notebook tools, account synchronization, responsive tabs and four-screen checks remain gates. Actual device Pencil/Safari behavior remains unverified.
