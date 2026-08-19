# The icon system

Ten glyphs, drawn for this page rather than pulled from a general set. They live
in the `I` map at the top of `main.js`.

## Rules, all of them non-negotiable

- **24 by 24 viewBox.** Divides by 2, 4, 8 and 12, so a glyph stays crisp at 16px
  and at 48px.
- **Stroke 1.5, everywhere.** Mixing weights is the fastest way to make a set look
  bought rather than made.
- **Round caps and joins**, `fill="none"`, stroke on `currentColor` so both styles
  and the dark band all work without a second copy.
- **One optical box**, roughly x 2.5 to 21.5 and y 3 to 21. This is the rule the
  first attempt broke: three shapes sitting in the middle third of the grid read
  as a squashed smudge beside a glyph that filled the frame.
- **Quarter grid coordinates**, two decimals at most. No 12.333.
- Optical, not mathematical, centring. The hourglass is 11 units wide against the
  mortarboard's 20, and that is correct, because a tall narrow object drawn to the
  same width would look fat.

## What each one says

| Key | Drawing | Stands for |
|---|---|---|
| `kinds` | a window, a circle, a square | different kinds of artifact |
| `spec` | a page with a tick and two lines | what a paper should carry |
| `compare` | two panels, different marks inside | A against B |
| `teach` | a mortarboard | teaching |
| `gap` | a window, half of it dashed | the part that cannot be rebuilt |
| `endures` | an hourglass | what lasts |
| `walk` | a screen with a pointer | the walkthrough |
| `groups` | two pairs of people | working in twos and threes |
| `remix` | a branch splitting off a line | a variation |
| `extend` | a window with a plus | adding your own |

## What this replaced

A wide flowchart under the live session: one paper, three group clusters, three
output windows, dashed loops, six text labels. It was a wireframe, not a drawing,
and it looked it. That block is now four steps in this same icon language, which
also means the page has one visual vocabulary instead of two.
