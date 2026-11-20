[![make.fun](https://make.fun/badge/news-image-20261119.svg)](https://make.fun/bounty/news-image-20261119)
[![rank](https://make.fun/badge/news-image-20261119/vayne01-hub/news-image-20261119-v6/rank.svg)](https://make.fun/bounty/news-image-20261119)
[![reward](https://make.fun/badge/news-image-20261119/vayne01-hub/news-image-20261119-v6/reward.svg)](https://make.fun/bounty/news-image-20261119)

# news-image-20261119-v6

One PNG that sums up the world news of Thursday 19 November 2026, drawn from
scratch as a broadsheet newspaper front page: masthead with the giant date,
a GTA VI sunset hero, a numbers strip, six feature cards, a 13-item brief
index, a numbered world map, and a DATE CHECK footer.

Candidate "C3": the C2 layout kept exactly, plus two changes. Every story is
numbered twice — once on its card (a red numbered badge on the hero and on
each feature card) and once on the map (a matching numbered pin), so the
reader can cross-check card, number and place at a glance. And the stroke
font was re-kerned: per-glyph advances plus kerning pairs for the narrow
letters (i, l, j) after wide ones (M, m, w, A, V, T), which closes the
hollow gaps C2 showed inside words such as "Midnight", "committed" and
"Anthropic".

Stories: GTA VI goes on sale after 13 years; the first Trump–Xi–Putin
three-way summit at APEC in Shenzhen; the ICJ's 9–6 genocide finding
against Myanmar; Anthropic's record $81.3bn IPO; Ukraine's third strike on
the Crimea bridge in a week; the COP31 draft dropping fossil fuels and the
$120bn aid goal; Saudi intercepts over Riyadh; plus the US Senate's 51–48
Iran war-powers vote, South Korea's 551,864 exam sitters, Denmark's 109–0
Greenland vote, and ten more briefs.

## Run

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` (Node 22, standard library only, no network) draws the page with
its own framebuffer, primitives, stroke font and PNG encoder, and writes
exactly one file: `$MAKEFUN_OUTPUT_DIR/entry.png` (1024x1024, deterministic —
two runs are byte-identical).

## Entry

- Competition: [news-image-20261119](https://make.fun/bounty/news-image-20261119)
- License: MIT
