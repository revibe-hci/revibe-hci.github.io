# Revibing HCI, UIST 2026

The workshop site. Plain HTML, CSS and JavaScript. No build step, no
dependencies, no framework.

    index.html    the whole page
    styles.css    both styles, driven by tokens on .page
    main.js       style switch, the hero visual, the field, themes and lists
    assets/       fonts, the paper images, organizer photographs

## Running it

Any static server. From the repository root:

    python3 -m http.server 8000
    # then open http://localhost:8000/

## Deploying

This repository is the site root, and GitHub Pages serves the default branch as
it is. Nothing needs compiling, so pushing to `main` publishes. The page loads
about 650 KB.

Every path in the page is relative, so the site also works from a subfolder or
from a different host without changing anything.

## Sending it as one file

A script in the private working folder, `build.py`, also writes a single
`dist/index.html`, about 1.7 MB, with every font, image, style and script base64
inlined. That file is for sending to people who will not
run a server: it opens by double-clicking, works offline, and keeps the demo, the
wave and the flip cards. It is not for deploying, because it cannot carry a link
preview and cannot be indexed, and because 620 KB of it is only the base64 copy of
the proposal PDF.

One thing in it needs care. A browser refuses to navigate to a `data:` URL, so an
ordinary link to the inlined proposal does nothing at all when clicked. The build
therefore adds a `download` attribute to that link, which browsers do allow, so in
the single file the proposal saves to disk instead of opening. Any other linked
file added to the page will need the same treatment.

Two smaller notes for that file. Opened from disk, the style choice will not
persist in Safari, which blocks local storage for local files; the code expects
that and falls back to Quiet. And the workshop is dated and venued in the markup,
so a copy sent out today will not know if those change.

## Editing

**Two styles.** Quiet and Studio are token blocks at the top of `styles.css`.
Every rule below reads tokens, so a third style is one more block, and nothing
else changes. The visitor's choice is kept in `localStorage` under
`revibe-style`.

**The program.** Rows are in `index.html` under `.prog`. A row is a time, an
`h3`, and optionally a `p.d`. Welcome, Introductions, Lunch and Closing have no
description on purpose. Times sit in the left page margin, absolutely positioned,
and fall back inline below 1180px.

**The breakout themes** and **the committee** are arrays at the bottom of
`main.js`, so adding a person means adding one line. The first three rows of
`CREW` are the leads and render in their own row above the rest, so reordering
that array changes who is a lead.

**Photographs.** All eleven are in `assets/photos`, 200px square, each taken from
that person's own page. Sources are listed in `assets/photos/SOURCES.md`. Ask
before launch. To replace one, overwrite the file; the name is the fourth slot of
that person's row in `main.js`.

**Still to fill in.** `APPLY_URL` near the bottom of `main.js` is the one place
the application form URL lives. It currently points at the UIST 2026 registration
page as a stand-in, and `main.js` writes it onto every element marked
`data-apply`. Put the real form URL there and every Apply button follows. The two
dates that say "To be announced" and the room number in the hero are the other
open items.

## Icons

Ten glyphs drawn for this page, in the `I` map in `main.js`. See `ICONS.md` for
the rules before adding an eleventh.

## The hero visual

`#hero-visual` in `index.html` holds the paper page and the empty agent panel,
and `main.js` builds the rest: the log lines, the running reimplementation, the
origin sequence and the stroke.

**What it shows,** in three columns, left to right. The real first page of
CrossY, a UIST 2004 paper by Apitz and Guimbretiere. Then what the agent did to
it, as a short log. Then that paper's technique, rebuilt: draw one stroke down
the column of controls and every control the line crosses is set, and the
preview word changes as they change.

The three columns are the whole point of the arrangement. A page, the work, and
the result, in the order they happened. Keep them in that order and side by side
as long as the width allows, which is what the media queries do.

The caption is a fourth row spanning all three columns, not a note beside the
paper. It describes the panel rather than the page image, and on its own row it
stays on one line instead of breaking into two in a narrow column.

**The terminal** keeps its own dark palette rather than reading page tokens,
because a terminal that turns white in one of the two styles stops being a
terminal. The colours are Studio's dark band, one step darker, so the two agree.

Six lines: the request, four commands, and `revibe running`, which never
completes and keeps a turning spinner for as long as the page is open. Every
line reserves its height from the start through a `min-height` on the row. An
empty row holds no content and would collapse, and the terminal would then grow
line by line and shove itself around inside a centred row.

The commands are the `STEPS` array in `main.js`, and each one carries what it
produced. `read crossy-p1.pdf` lands the first two marks on the paper,
`extract figure 1` lands the box on the figure, `list the controls` lands the
other two marks and brings up the window with its four labels, and
`build the interface` fills that window in. So the log explains the page rather
than running beside it.

The interface therefore arrives in two beats rather than one. On the third
command there is a window, a title bar and four labels, and nothing else,
because a list of controls is genuinely all the agent has at that point. On the
fourth the boxes, the divider and the preview word follow. Before the third
command the window is not there at all. An empty frame with nothing in it says
less than plain panel does, and a hidden window also carries
`pointer-events: none`, or it would swallow a click meant for what is behind
it and skip the build. Adding a fifth command means
adding an entry, but check the width first: the terminal is sized to its longest
line, and a rule at 1000px holds 10.75rem for exactly that reason.

**The sequence.** The paper straightens and a reading band crosses it. Then the
request types, then each command in turn: the line appears with a spinner, types
itself, holds, takes a green tick, and only then does the next one appear. Three
constants at the top of that code set the pace, `TYPE_MS`, `HOLD_MS` and
`GAP_MS`. The gap is what makes the log read as one command finishing and
another starting rather than as four lines arriving together. The whole thing
takes about six seconds.

**When it starts** is the part worth reading before changing anything. Being on
screen in a visible tab is not the same as being looked at. A tab opened in the
background and read an hour later, or a page left open behind another window,
would both burn the sequence with nobody there, and the visitor would arrive to
a finished panel and never learn what it was.

So the terminal waits with an empty prompt and a blinking cursor until a person
proves they are present. Any real input on the page counts: a pointer moving, a
key, a wheel, a touch, a scroll. Putting a pointer anywhere on the panel counts
and starts it at once. Failing both, four unbroken seconds of the panel being on
screen in a focused window counts, which is there for the reader who never moves
anything. Reaching for the demo counts too, and skips to the finished state.

A visitor who asked for reduced motion never waits, because the still frame is
not an animation and cannot be missed.

After that the demonstration stroke repeats every few seconds, and every third
stroke the whole thing resets and builds again from the paper, so a visitor who
arrives late still sees where the interface came from. Reaching for the demo
mid-build finishes the build at once rather than making you wait.

**Editing it.** The controls are the `CONTROLS` array in `main.js`, and each one
names a class that `styles.css` applies to the preview word. The sequence timings
are the `at(...)` calls in `play()`, in milliseconds. The demonstration stroke
takes `GHOST_MS`.

**The marks on the paper** are percentages of the page image, and they were
measured rather than guessed. An earlier set was placed by eye and sat wrong:
the figure box was twelve points of height too high, over the author addresses
instead of the figure, and each text mark cut through the middle of three lines.
The measurements for `crossy-p1.jpg` are in a comment above the rules. The two
text columns are x 8.8% to 48.0% and x 52.1% to 90.9%, a line is 1.1% tall on a
1.5% pitch, and the figure occupies 51.8%, 31.8%, 39.1% by 21.6%.

To use a different paper, replace `assets/paper/crossy-p1.jpg`, its `alt` text
and the caption, then measure the new page the same way. Threshold the image at
about 190, project the dark pixels down each column to find the gutter, then
project across to find the line bands. Put each mark on a line boundary and make
it two lines tall, so none of them cuts through text.

**Dragging.** `.rv-app` sets `user-select: none` and `touch-action: none`, which
is what stops a stroke from selecting the labels or scrolling the page on a
phone. A drag draws and crosses; a tap on a control toggles it. The two are told
apart by how far the pointer moved, so a stroke that happens to end on a control
does not also click it. Hit testing samples along each segment, so a fast drag
cannot jump over a control.

**Keyboard and screen readers.** The controls are real buttons with
`role="switch"`, so they work without drawing. The paper is an `img` with a
description. The stroke layer is decoration and hidden from screen readers.

## The ambient field

The field covers the whole back of the hero: one glyph per shelved system, papers
turning into running interfaces in six different shapes, because the ten systems
in the paper were a node editor, a notebook, a video tool and others.

The change travels as a wave, left to right: papers ahead of it, systems inside
it, papers again behind. About a third of the shelf is running at any moment, and
that band walks across the hero and wraps around to start again. A third is
already running when the page loads, set without animating so the first paint is
not a hundred flips at once. Roughly one glyph in fourteen never comes back, which
is the honest part of the picture. Hovering or tapping a paper revives that one
yourself.

The wave is one ordered walk through the glyphs. `plan()` sorts them by their own
position, column by column with a slight downward tilt and some jitter, so the
front is ragged rather than a straight edge. `band()` is how wide the wave is and
`step()` moves it along. How many glyphs exist is worked out from the measured
hero and capped at `CAP`.

Pace matters more than it sounds. Each step revives some glyphs and retires the
same number behind, so the visible rate is twice `per` in `step()`. At two per
step every half second that is about seven changes a second, the front crosses a
column every five seconds or so, and a full sweep takes two minutes. An earlier
version moved one glyph per second, which was too slow to read as a wave at all:
in half a minute under seven per cent of the field changed, so it looked static
and only hover seemed to do anything.

Hovering a glyph flips it either way, paper to system and system back to paper,
and whatever just changed flares briefly so a hover feels answered and the front
of the wave can be followed by eye. The glyphs that never come back ignore hover
on purpose. Hover only reaches the parts of the field the copy and the panel do
not cover, since those take their own pointer events.

The glyphs keep their rows and columns. Only the angle varies, by a few degrees
each, which reads as a shelf of papers rather than as a printed pattern.

What keeps the field out of the way of the words is the wash on
`.hero-field:after`: solid page colour over the copy, dissipating outward in every
direction, with a light veil left in the far corners. An edge anywhere would show,
and this has none. The hero panel is translucent too, so the field carries on
behind the demo instead of stopping at a hole.

## The background section

The words sit on the left, the paper on the right, sized so the two columns come
out within a few pixels of each other: heading, explanation, the three numbers and
the failure note against the paper's own first page. Below a rule are the ten
graded systems and, beside them, two cards.

The wall sits on the left and the cards on the right, small and side by side,
with the mean revibeability of each tool under them. The two columns come out the
same height, so neither one leaves a hole. The tool figures are means across every
run rather than the best one, which is why they are lower than the 94.1% above,
and they live in the `TOOLS` array in `main.js`.

The cards are landscape, the same shape as the screenshots on their backs, so a
front and a back fill the same frame with nothing letterboxed. The front is a wide
band from the top of the paper, zoomed slightly to trim the page margins and the
arXiv date stamp. The backs are the screenshots at their own resolution, pulled
straight out of the paper with `pdfimages` rather than cropped from the composite
figure, which is why they are sharp. None of the four card images uses
`loading="lazy"`: a back face is rotated away with `backface-visibility: hidden`,
and the browser can decide it is not visible and never load it. Below 900px the paper drops under the words
rather than being stranded in a narrow column.

## The committee

Everyone is styled the same. The grid is twelve equal columns, every person spans
three of them, and the fourth person is told to start a new row. That leaves the
three who lead the workshop alone on the first row at exactly the same width and
spacing as everyone below. Who leads is therefore the order of the `CREW` array,
not a separate list or a label.

The columns are `minmax(0, 1fr)` rather than `1fr` on purpose. With plain `1fr` a
long affiliation widens its own column, the twelve tracks stop being equal, and
the rows no longer line up.

## Section labels

The small label above a heading is only there when the heading does not already
name the section. Background keeps one, because its heading is a paper title.
Program, Outcomes, Registration and Organizers do not, because the heading says it.

## How the motion behaves

Every moving part follows the same three rules, which are worth keeping:

- It stops when it scrolls out of view, and when the tab is hidden. That is the
  `whenVisible` helper in `main.js`.
- Under `prefers-reduced-motion` it holds a finished still frame, never a paused
  transition. The hero shows the completed stroke, the field sits part revived
  and never drifts, and one card rests on its back.
- Only one thing moves at a time in any one screen.

No animation library. CSS transitions do the flips and fades, and one
`requestAnimationFrame` loop draws the stroke. If we later want scroll-driven
sequences, the smallest sensible step up is Motion, about 18 KB over the Web
Animations API. CSS scroll-driven animations now cover much of this natively.

Six earlier hero animations were built and rejected, and three later rounds of
concepts after them. They are kept in the private working folder under `designs/`,
with notes in `designs/ANIMATION.md`. Read those before proposing a seventh, so
the same ideas are not rebuilt.

## Images

`assets/paper/` holds five images, all rendered from PDFs with `pdftoppm`:

    page1s.jpg                    first page of the revibing paper, 660px wide
    crossy-p1.jpg                 first page of CrossY, UIST 2004, in the hero
    spellburst-p1.jpg             first page of Spellburst, UIST 2023, on a card
    rescribe-p1.jpg               first page of Rescribe, UIST 2020, on a card
    revibe-spellburst-claude.jpg  Spellburst as Claude Code rebuilt it
    revibe-rescribe-cursor.jpg    Rescribe as Cursor rebuilt it

The paper thumbnail is itself the link to the paper, and its caption credits the
five authors and says the paper is to appear at UIST 2026.

Two of the revibing paper's authors organize this workshop, so reusing its
figures is straightforward. The CrossY, Spellburst and Rescribe pages came from
the authors' own copies, at
`lri.fr/~mbl/FundHCI/papers/Apitz-UIST04.pdf`, `arxiv.org/abs/2308.03921` and
`arxiv.org/abs/2010.03667`. Confirm all five before launch.

The two revibe screenshots came out of the paper's Figure 1 with
`pdfimages -png -f 1 -l 1`, which yields the six panels as separate files at their
own resolution. In that figure the columns are Claude Code, Cursor and Gemini from
left to right, and the rows are Spellburst then Rescribe, so the extraction order
tells you which file is which. Confirm against the figure before swapping one.

## One trap in the CSS

`.page p { margin: 0 }` is a class plus a type, so it outranks a bare class. A
rule like `.minihead { margin-bottom: .7rem }` on a paragraph therefore does
nothing at all, silently. Six rules were sitting dead this way. Anything that
gives a classed paragraph a margin is written `.page .minihead { ... }` for that
reason. If a gap you added refuses to appear, check this first.

## Links to papers

Every paper the site names is a link. The ten systems in the wall, the two cards
and CrossY in the hero all point at `doi.org`, and the DOIs came out of the
revibing paper's own bibliography rather than a search, so they match the versions
that were actually revibed. The mapping lives in the `SYSTEMS` and `PAIRS` arrays
in `main.js`. Names in the wall and in the captions stay ink coloured and only
turn on hover, so those blocks do not fill up with blue.

The revibing paper is linked from its own thumbnail, at
`arxiv.org/abs/2608.00450`, so there is no separate "read the paper" line. The
arXiv record lists Eytan Adar, Yoonjoo Lee, Nina Lei, Q. Vera Liao and Weirui
Peng, and its comments field says UIST 2026, which is where the caption comes
from.

Every link that leaves the page opens in a new tab. That is not written on each
anchor: `main.js` sets `target` and `rel` on every link whose href does not start
with `#`, and it runs last so it catches the committee, the wall, the cards and
the apply buttons too. Add a link anywhere and it inherits the behaviour.
