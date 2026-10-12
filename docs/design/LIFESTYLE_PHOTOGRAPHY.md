# Folio lifestyle photography

## Modern Vintage/Retro defaults — 2026-10-12

Built-in imagegen generated four decorative editorial photos; Pillow only encoded the approved results as WebP at quality 88. These photos are decorative and never used as source evidence. No stock facts or prices are depicted.

| Cover | Project asset | Personal photo priority |
| --- | --- | --- |
| 오늘 | `public/folio-retro-today.webp` | Latest available photo in today's locally dated records |
| 발견 | `public/folio-retro-discover.webp` | Latest photo in investment records related to current leaders |
| 저널 | `public/folio-retro-journal.webp` | Latest available journal photo |
| 여정 | `public/folio-retro-journey.webp` | Latest available investment photo |

Unavailable personal images fall back to the next relevant personal image, then the corresponding default. Covers retain exactly one title and one-line summary. Assets are published in both Actions output and branch Pages root.

## Exact prompt set

### today

Use case: photorealistic-natural. Asset type: landscape editorial photo cover for a modern lifestyle app. A quiet morning by a large window in a modern vintage café, a folded blank newspaper and an unbranded small chrome radio on a dark wood table, coffee cup, soft morning street reflections beyond the window. Theme: reading the changing world. Modern Vintage/Retro photography, authentic fine 35mm film grain, subtle faded colours and gentle halation, warm ivory and muted sage, charcoal and restrained rust, contemporary refined composition rather than kitsch. Real photographic textures, uncluttered subject, graceful light and soft contrast. Landscape 3:2 composition, useful focal detail across center and upper half, darker lower area for a small white UI title which will be added in code. No text, lettering, numbers, logos, watermark, graphic overlays, borders or UI. No people. Produce one photograph, not a collage.

### discover

Use case: photorealistic-natural. Asset type: landscape editorial photo cover for a modern lifestyle app. A modernist 1970s concrete building and a curved exterior staircase, dappled foliage shadows, one small terracotta planter, beautiful architectural discovery on a bright quiet day. Theme: new perspectives and discovery. Modern Vintage/Retro photography, authentic fine 35mm film grain, subtle faded colours and gentle halation, warm ivory and muted sage, charcoal and restrained rust, contemporary refined composition rather than kitsch. Real photographic textures, uncluttered subject, graceful light and soft contrast. Landscape 3:2 composition, useful focal detail across center and upper half, darker lower area for a small white UI title which will be added in code. No text, lettering, numbers, logos, watermark, graphic overlays, borders or UI. No people. Produce one photograph, not a collage.

### journal

Use case: photorealistic-natural. Asset type: landscape editorial photo cover for a modern lifestyle app. An open blank cream notebook, capped fountain pen and a simple analogue film camera on a walnut writing desk near a sunlit window, linen curtain at the edge. Theme: everyday memories and thoughtful writing. Modern Vintage/Retro photography, authentic fine 35mm film grain, subtle faded colours and gentle halation, warm ivory and muted sage, charcoal and restrained rust, contemporary refined composition rather than kitsch. Real photographic textures, uncluttered subject, graceful light and soft contrast. Landscape 3:2 composition, useful focal detail across center and upper half, darker lower area for a small white UI title which will be added in code. No text, lettering, numbers, logos, watermark, graphic overlays, borders or UI. No people. Produce one photograph, not a collage.

### journey

Use case: photorealistic-natural. Asset type: landscape editorial photo cover for a modern lifestyle app. A winding coastal footpath above the sea, viewed from a quiet hillside with wind-shaped grass and a distant small headland, serene bright daylight. Theme: looking back and choosing a direction. Modern Vintage/Retro photography, authentic fine 35mm film grain, subtle faded colours and gentle halation, warm ivory and muted sage, charcoal and restrained rust, contemporary refined composition rather than kitsch. Real photographic textures, uncluttered subject, graceful light and soft contrast. Landscape 3:2 composition, useful focal detail across center and upper half, darker lower area for a small white UI title which will be added in code. No text, lettering, numbers, logos, watermark, graphic overlays, borders or UI. No people. Produce one photograph, not a collage.


The earlier `folio-lifestyle-journal.webp` and `folio-lifestyle-journey.webp` defaults were replaced by this set. Supplied wordmark, app icon and loading artwork were not regenerated.

## Modernist update and independent display treatment

User explicitly chose the independent in-app film expression after reviewing the VSCO integration limitation. Reference: https://www.vsco.co/features/film-filters . No VSCO preset, API or licensed film model is used. A shared CSS display treatment uses contrast(.94), saturation(.82), sepia(.11), brightness(1.025), on both covers and expanded photos. Original stored/uploaded data remains untouched.

Three defaults were replaced with modernist imagery. Built-in imagegen created the source PNGs; Pillow only encoded WebP. Discover retains the modernist concrete stairway from the first set.

Today prompt:

Use case: photorealistic-natural. Asset type: photo cover for the Today page of a modernist lifestyle app. A serene modernist reading corner: floor-to-ceiling rectangular window, slender black steel chair, pale concrete floor, one round chrome side table holding a folded blank newspaper and white coffee cup, long geometric daylight shadows. Refined Bauhaus and international-style architectural photography, 35mm editorial composition, accurate materials, subtle photographic texture, neutral softly natural colours before a film-look display effect is added in the app. Wide landscape 3:2, focal detail in center and right, enough darker lower area for a white UI title. No people, readable text, lettering, logos, watermark, border, UI, illustration or collage.

Journey prompt:

Use case: photorealistic-natural. Asset type: photo cover for the Journey page of a modernist lifestyle app. A quiet modernist coastal promenade curving toward a pale blue sea, low smooth concrete wall, repeated slender black railings, softly wind-shaped coastal grasses, distant horizon, elegant leading lines. Refined modernist architectural landscape photography, serene contemporary editorial 35mm composition, realistic clean daylight and neutral natural colours before a film-look display effect is added in the app. Wide landscape 3:2, path detail crosses center, darker lower area for UI title. No people, signs, readable text, logos, watermark, UI, illustration, collage or borders.

Journal prompt:

Use case: photorealistic-natural. Asset type: landscape photo cover for the Journal page of a modernist lifestyle app. An open completely blank notebook and a simple black fountain pen on a pale smooth cantilever writing desk, chrome tubular chair at the edge, large rectangular studio window, restrained geometric shadows across paper and concrete. Quiet intimate writing moment, modernist functional design, refined architectural still-life photography, contemporary editorial 35mm composition and realistic materials, clean neutral light before an independent film-look display effect is added in the app. Wide landscape 3:2, notebook near center, subtle dark areas near lower edge for UI title. No people, handwriting, text, logos, watermark, UI, illustration, collage or borders.
