# Wanderlust: Design Specification

| | |
| --- | --- |
| **Document status** | Draft v1.0 |
| **Depends on** | `PRD.md` (scope, pages, states, decisions D1 to D11) and `docs/design/color-system.md` (colour tokens, contrast) |
| **Audience** | Coding agents and developers building or changing any user interface |
| **Precedence** | PRD decides what exists. This document decides how it looks and behaves. The colour system decides every colour. If two documents conflict, stop and ask. |

## How agents must use this document

1. Build with the rules and tokens here. Never invent a colour, size, radius, shadow or animation that is not defined.
2. Reuse an existing component before creating a new one. A new component needs a new entry in section 7 first.
3. Reference colour, type, space and radius by token name only. No raw values in component styles.
4. The content security policy forbids inline styles and scripts. Style with classes in stylesheets and behave through script files.
5. A change is not finished until it passes the checklist in section 17.

---

## 1. Visual direction

### 1.1 Concept: the atlas

Wanderlust looks like a well-made travel atlas that has been turned into a booking tool: calm stone paper, deep ink, one thread of brass, and photographs doing the talking. It borrows the restraint of boutique hospitality brands and the clarity of good product design. It does not look like a dashboard, a template or a marketplace.

The signature details:

- **Coordinates.** Each stay shows its place name together with its latitude and longitude in the small mono label style, when the stay has a pin.
- **The meridian mark.** The logo and the map band use fine globe lines (a circle, one meridian ellipse, an equator) in thin strokes.
- **Serif headlines with one italic word in brass.** Used for the main page headline and the closing footer line only.

### 1.2 Principles

| # | Principle | What it means in practice |
| --- | --- | --- |
| 1 | **Photographs lead** | Photos are the most colourful and largest thing on any screen. Interface colour stays quiet around them. |
| 2 | **One main action** | Each view has exactly one primary button. Everything else is secondary, outline or text. |
| 3 | **Say less, show price and place** | A stay card shows place, title, price and rating. Nothing else. No badges stacked on badges. |
| 4 | **Tone instead of effects** | Depth comes from a lighter surface on a stone ground and a hairline, not from shadows, glows or blur. |
| 5 | **Honest interface** | Never display a number or claim the product does not know (no fake ratings, counts, urgency or social proof). |
| 6 | **Same rule everywhere** | One button, one card, one field. Pages are built from components, not styled one by one. |
| 7 | **Calm at every size** | Layouts reflow into a single clear column on a phone. Nothing is hidden because it is hard to fit. |

### 1.3 What it must not look like

Gradient backgrounds, frosted-glass panels, coloured shadows, neon, emoji, stock-photo avatars, floating decorative blobs, tilted cards, confetti, countdown timers, "only 2 left" nudges, rounded cards with a coloured left edge, and centred hero text over a dark photo overlay with three buttons. If a screen could belong to any other travel site, it is wrong.

---

## 2. Colour

All colours come from the Wanderlust colour system. This section says where each token is used. Hex values live only in the colour system and in the token stylesheet.

### 2.1 Themes

- **Stone** (light) is the default. **Night** (dark) is applied by a theme attribute on the root element. Components never contain theme-specific values.
- Photographs are never tinted or dimmed in either theme, except for the single scrim token behind text on a photo.

### 2.2 Role map

| Surface or element | Token |
| --- | --- |
| Page ground | `bg` |
| Cards, search bar, panels, form containers | `surface` |
| Menus, popovers, date pickers | `surface-raised` |
| Wells, input fill, table headers, skeletons | `surface-sunken` |
| Hairlines and dividers | `border` |
| Input, checkbox and toggle edges | `border-strong` |
| Headings, prices, main text | `text` |
| Descriptions, form labels | `text-secondary` |
| Captions, helper text, coordinates, placeholders | `text-muted` |
| Disabled text | `text-disabled` |
| Primary button fill, header logo, dark bands | `primary` with `on-primary` text |
| Secondary button, selected chip, supporting icons | `secondary`, `secondary-subtle` |
| Headline emphasis, ratings, small rules, map pins, numerals | `accent` |
| Solid brass badge or highlight (rare) | `accent-fill` |
| Success, warning, error | `success`, `warning`, `error` with matching `-subtle` backgrounds |
| Links | `link`, `link-hover` |
| Hover and pressed on ghost items | `state-hover`, `state-pressed` |
| Keyboard focus | `focus-ring` with `focus-offset` |
| Overlay behind modals and text on photos | `scrim` |

### 2.3 Rules

- **Proportion.** About 60% ground and surface, 30% text and ink, 8% structure colour (primary and secondary fills), 2% brass.
- **Brass** is for emphasis only: italic headline word, rating stars, numerals, thin rules, map pins. Never body text, never a large background, never on `surface-sunken`.
- **Status** is always colour plus icon plus words. Alerts pair the status colour with its `-subtle` background.
- **Text on photos** must sit on a solid `surface` label or on the `scrim` token. Never place text directly on a busy photo.
- **No gradients.** The one permitted exception is a scrim behind text on a photograph.

---

## 3. Typography

### 3.1 Families

| Role | Family | Used for |
| --- | --- | --- |
| Display | Instrument Serif | Page headlines, section titles, stay titles |
| Sans | Geist | Body, navigation, buttons, forms, prices |
| Mono | Geist Mono | Small labels, coordinates, step numbers |

Fonts are self-hosted (PRD decision D7). Each has a system fallback of similar proportions. Text must stay readable without the web fonts.

### 3.2 Scale

| Style | Desktop | Tablet (under 992) | Phone (under 576) | Weight | Notes |
| --- | --- | --- | --- | --- | --- |
| Display XL | 92 / 0.96 | 64 | 44 | 400 | Home headline only. Tight tracking. |
| Display MD | 56 / 1.0 | 44 | 34 | 400 | Section titles. |
| Title | 30 / 1.1 | 28 | 26 | 400 | Stay titles on cards, sub-sections. |
| Title Small | 25 / 1.08 | 24 | 22 | 400 | Compact cards. |
| Body L | 18 / 1.55 | 17 | 17 | 400 | Lead paragraphs. |
| Body | 16 / 1.6 | 16 | 16 | 400 | Default. Never smaller on forms (prevents zoom on phones). |
| Body Strong | 16 / 1.5 | 16 | 16 | 600 | Prices, button labels. |
| Small | 14 / 1.5 | 14 | 14 | 400 | Card details, helper text. |
| Label | 12 / 1.4 | 12 | 12 | 400, mono | Uppercase, wide tracking. Field captions, place names, tags. |

Sizes are in pixels for desktop with line-height after the slash. Use relative units in code so user text-size settings work.

### 3.3 Rules

- Headlines in the display family are set in sentence case, never all caps, never bold.
- Labels in the mono family are uppercase with wide tracking. They are never used for sentences.
- Line length for paragraphs: 45 to 75 characters. Use a maximum width, not a narrow column.
- Prices use Body Strong with the currency symbol. The unit "/ night" follows in Small and `text-muted`.
- Numbers in columns and prices use tabular figures where the font supports them.
- Balanced wrapping on headlines. No orphaned single words on the last line.
- Do not use more than two weights on one screen.
- Links in running text are underlined. Links in navigation are not, and show their state with weight or a rule.

---

## 4. Spacing and layout

### 4.1 Spacing scale

An 8-point rhythm with a 4-point half step.

| Step | Value | Typical use |
| --- | --- | --- |
| 4 | 4px | Icon to text in tight pairs |
| 8 | 8px (token `space-1`) | Gaps inside controls, chip gaps |
| 12 | 12px | Gap between label and field |
| 16 | 16px (`space-2`) | Control padding, gap inside cards |
| 24 | 24px | Gap between related groups |
| 32 | 32px (`space-3`) | Gutters between cards |
| 48 | 48px | Gap between blocks in a section |
| 64 | 64px (`space-4`) | Section padding on content pages |
| 96 and 112 | 96 and 112px | Space between major home page sections |

Steps 4, 12, 24, 48, 96 and 112 are not yet tokens. Add them to the token file before use. Do not use any other values.

### 4.2 Container and grid

- Page content sits in a centred container, maximum 1360px including 40px side padding. Side padding is 24px under 992px and 16px under 576px.
- The header and footer use the same container so edges align.
- Stay grids use automatic columns with a minimum card width: 300px on large grids, 240px on compact grids. Gutter 32px (large), 28px (compact), 24px under 576px.
- Forms and reading pages use a narrower column: 640px for forms, 720px for text.
- Align everything to the container edges. A heading and the cards under it share the same left edge.

### 4.3 Breakpoints

| Name | Min width | Behaviour |
| --- | --- | --- |
| Phone | 0 | One column, navigation in a menu |
| Large phone | 576 | Two-column card grids start where space allows |
| Tablet | 768 | Booking panel can sit beside content on stay pages |
| Small desktop | 992 | Full navigation bar, three-column grids |
| Desktop | 1200 | Four-column compact grids |
| Wide | 1400 | Container stops growing |

These match the existing Bootstrap breakpoints so the app keeps working with the framework. Bootstrap is used for the grid only. Components are styled by this document, not by default Bootstrap look.

### 4.4 Shape, borders, depth

| Item | Rule |
| --- | --- |
| Radius | `radius-sm` 3px on tags. `radius-md` 4px on photographs, cards, bands. `radius-lg` 8px on the search bar and large input panels. `radius-pill` on buttons, filter pills and the save button. |
| Borders | 1px `border` for grouping. `border-strong` on every control edge. |
| Elevation | Flat by default. One soft shadow is allowed on the search bar and on floating cards over photos. Menus and popovers use a hairline plus `surface-raised`, no shadow spread. |
| Layers | Base content, sticky header, menus and popovers, modal overlay and modal, toast. Each layer sits above the previous. Define layer numbers once in the token file. |

---

## 5. Iconography and imagery

- **Icons:** one set, drawn with a thin consistent stroke, at 16, 20 or 24px. Pick a single library and remove the others (currently two are loaded). Icons are never the only label on a control: icon-only buttons have an accessible name.
- **No emoji** in the interface or content.
- **Photography:** real listing photos only. Cards use a 4:5 crop, the feature card 3:2, the hero a tall crop. Photos fill their frame with the subject kept visible.
- **Image behaviour:** every image box has a reserved aspect ratio so the page does not jump. Photos below the fold load lazily. The hero photo does not. If a photo fails to load, the frame shows a flat tone from `surface-sunken` and the alt text.
- **Alt text** is the stay title plus place. Decorative images have empty alt text.

---

## 6. Navigation

### 6.1 Header (all pages)

| Part | Rule |
| --- | --- |
| Logo | Meridian mark plus the word "Wanderlust" in the display family. Links home. |
| Primary links | Stays, Map, Saved, Trips. The current page has a 1.5px underline in `text` and full weight. Others use `text-secondary`. |
| Right side | Logged out: Log in as an outlined pill. Logged in: the **mode switch** (one labelled button), then the account menu showing the user's initial. There is no "host a stay" link anywhere: switching modes replaces it. |
| Links by mode | Guest mode: Explore, Map, Saved, Trips. Host mode: Your listings, Create listing, Reservations. Home shows them in the sidebar; below the large breakpoint they sit in the account menu. |
| Height and spacing | Content row of at least 44px high targets, 28px above, 56px below on the home page. |
| Behaviour | On home the header sits inside the hero. On every other page (outside sign-in and sign-up) it is a sticky glass bar (`.wl-navbar`: `--glass-bg` with the blur from `tokens.css`, a `--glass-border` hairline underneath). |
| Rail | The floating glass rail (`includes/sidebar.ejs`) shows on every page outside auth from 993px up. Page content is centred between two rail gutters (`--rail-gutter`). From 1200px the header hides its page links because the rail carries them; between 993 and 1199px they sit in the header's collapsed menu. |

The old dark sidebar is retired (PRD FR-16); the floating rail replaced it.

### 6.2 Account menu

Contents for a logged-in user, the same in both modes: Profile, Log out. There is no separate Account entry: settings live on the profile. (Below the large breakpoint on the home page the mode's links are added above them.) Log out is a form submit, not a link. The menu opens on click, closes on Escape or outside click, and returns focus to its trigger.

### 6.3 Phone navigation

Under 992px the primary links collapse into a menu button labelled "Menu". The menu opens as a full-width panel below the header with large 48px rows, the same links, and the Log in or account items at the bottom. The logo and the menu button stay visible. Search stays on the page and is not hidden.

### 6.4 Footer

Dark `primary` band. Logo, one italic line in brass ("Stay somewhere worth the journey."), three link groups (Explore, Hosting, Account), and a copyright line. Links are `text-inverse` with a visible hover underline.

### 6.5 Secondary navigation

- **Category tabs** on the home page: a single scrollable row of text links with a rule under the active one. On phones the row scrolls horizontally with a visible edge fade (a masking of the last item, not a gradient colour).
- **Pagination:** Previous, current page, neighbours, Next. Current page is a filled `primary` circle. Previous and Next are pills. Disabled ends are visible but muted.
- **Breadcrumbs** are not used. A stay page has a "Back to stays" link above the title.
- **Skip link:** the first focusable item on every page is "Skip to content".

---

## 7. Components

Naming rule for implementers: component classes are prefixed `wl-` and named for the component, not the page (for example one stay card class used on home, map popups and saved).

### 7.1 Buttons

| Variant | Appearance | Use |
| --- | --- | --- |
| Primary | `primary` fill, `on-primary` text, pill, 16px Body Strong | The one main action per view: Search stays, Reserve, Log in (form), Publish |
| Secondary | `secondary` fill, `on-secondary` text, pill | Supporting actions of equal weight in a toolbar |
| Outline | 1px `text` border, transparent, `text` label, pill | Filters, Next, Log in in the header |
| Ghost | No border, `text` label, `state-hover` on hover | Low-emphasis actions inside cards and tables |
| Destructive | `error` fill, `surface` text, pill | Delete listing, cancel reservation. Always confirmed. |
| Icon button | 44px circle, `surface` fill with hairline or none | Save heart, close, menu |

Rules:

- Minimum height 44px, 52px for the primary action on the home search and Reserve.
- Horizontal padding 20 to 28px. Label never wraps; shorten the copy instead.
- States: default, hover (`-hover` fill or `state-hover` overlay), pressed (`-pressed` or `state-pressed`), focus (ring), disabled (`text-disabled` on `surface-sunken`, no pointer), loading (label replaced by "Working…" and the button disabled, width unchanged).
- Two buttons side by side: primary on the right in a form, on the left in a toolbar. Never two primaries.
- A button that navigates is a link styled as a button. A button that changes data is a real button inside a form.

### 7.2 Links

Inline links use `link`, are underlined, and darken to `link-hover` on hover. Text links in lists and cards use `text`, and show an underline on hover. Arrow links ("See all stays") use a trailing arrow that moves 2px on hover.

### 7.3 Form field

- Layout: label above the control, then optional helper text, then the control, then the error message.
- Label: Label style or Small in `text-secondary`. Required fields are marked with the word "Required" in the helper, not just an asterisk.
- Control: 52px tall for single-line, `surface-sunken` or `surface` fill, 1px `border-strong`, `radius-lg`, 16px text. Placeholder uses `text-muted` and never replaces the label.
- States: default, hover (border darkens to `text-secondary`), focus (focus ring, border stays), filled, disabled, error (`error` border, `error-subtle` message background, icon plus text), success (only after server confirmation, never while typing).
- Error message sits directly under the field in Small, `error` text, with an icon. It says what to do ("Enter a password with at least 8 characters and one number").
- Textarea: same rules, minimum 4 rows, character count shown only near the limit.
- Select: native control styled to match. No custom dropdown replacing the native one on phones.
- Checkbox and radio: at least 24px box with a 44px tap area, `border-strong`, `primary` when checked.
- File upload: a dashed `border-strong` zone with the accepted types and size ("JPEG, PNG or WebP, up to 5 MB"), a preview after choosing, and a Remove link. Errors appear inside the zone.

### 7.4 Search bar (home)

A single `surface` panel with a hairline, `radius-lg`, and the single allowed soft shadow. Four labelled cells (Where, Check in, Check out, and Guests if D2 keeps it) separated by hairlines, then a full-width primary "Search stays" button under or beside them. Each cell has a Label caption and a 16px value. Cells stack on phones with the button last. No icons inside the cells.

### 7.5 Category tabs and filter pills

- Tabs: text links, 15px medium, 10px vertical padding, active tab has a 1.5px underline.
- Filter pills: outline pill, 44px high. The Filters panel opens inline below the tab row as a `surface` panel with the same field components. "Apply" is primary, "Reset all" is a text link.
- Selected filters are shown as dismissible pills above the results. Each pill has a close button with an accessible name.

### 7.6 Stay card (the core component)

Three variants share one structure.

| Variant | Where | Image ratio | Notes |
| --- | --- | --- | --- |
| Standard | Home, saved, search | 4:5 | Title in Title style |
| Feature | One per home page (top of the featured section) | 3:2, spans about two thirds | Title in a larger size, richer detail line |
| Compact | "More to explore", map popups | 4:5, smaller | Title Small, no detail line |

Anatomy, top to bottom:
1. Photo frame with `radius-md`. Inside it at the top left: a category tag (`surface` fill, Label style). At the top right: the save button (44px circle, `surface` fill).
2. Place line: Label style, `text-muted`, the place name and, when the stay has a pin, its coordinates.
3. Title: display family, `text`.
4. Detail row: left side small facts and rating, right side the price. Only facts the product stores are shown (PRD FR-19).
5. The whole photo and the title are links to the stay. The save button is a separate control.

Rules:
- Rating shows a star in `accent`, the number, and the review count only when the stay has reviews. With none it shows the word "New".
- Hover: the photo scales up slowly inside its frame (see section 11). The card does not lift or throw a shadow.
- The save button shows an outlined heart when not saved and a heart filled with `text` when saved. Its accessible name changes to match ("Save to wishlist" or "Remove from saved"). Logged-out users see a heart that links to Log in.
- Card heights in one row align at the top. The price always sits on the same baseline across a row.

### 7.7 Rating

A star icon in `accent`, followed by the number in Body Strong. For display of the review list, show the integer as filled stars with the number as text as well, so colour is never the only cue. The input control for a new review is a group of five radio buttons styled as stars, keyboard focusable, with a visible focus outline on the star and a label ("4 out of 5").

### 7.8 Price

Currency symbol, amount with thousands separators, then "/ night" in Small `text-muted`. The currency is the stay's own. No conversion. No strike-through or "deal" styling. Totals on the booking panel list nights times rate and the total in Body Strong.

### 7.9 Calendar (booking and search)

- Shows two months on tablet and wider, one on phones.
- Days that are booked, in the past, or beyond the 30-night limit are disabled: `text-disabled`, struck by a thin diagonal line, not clickable, and announced as unavailable.
- Selected range: start and end days filled `primary`, days between filled `secondary-subtle`, text `text`.
- Today has a thin ring. Keyboard: arrow keys move by day and week, Page Up and Page Down by month, Enter selects, Escape closes.
- Summary line under the calendar: "3 nights · ₹7,500" updating as the range changes. The Reserve button stays disabled until the range is valid.

### 7.10 Booking panel (stay page)

A `surface` card with hairline. Order: price line, date range (the calendar), nights and total, Reserve (primary, full width), small note "You will not be charged yet" only if D5 keeps reservations free of payment. Logged-out users see "Log in to reserve" as the primary button. Owners see Edit and Delete instead of Reserve.

### 7.11 Review item and review form

- Item: author name (Body Strong), date (Small `text-muted`), rating, comment (Body). Delete is a ghost button shown only to the author, with confirmation.
- Form: five-star radio group, comment textarea (optional, 1000 characters), primary "Post review". Hidden for the owner, with a short explanation instead.

### 7.11a Shared surfaces (every page outside home and auth)

- **Cards and panels** (`.wl-panel`, `.wl-empty`, `.wl-stat`, `.wl-toc`, booking rows, admin tables): `--glass-bg-subtle` fill, a 1px `--glass-border`, `--radius-xl` (empty states `--radius-2xl`). The border goes to `--glass-border-strong` on hover. No blur on these; blur is for floating surfaces only.
- **Buttons** (`.wl-auth-btn`, `.btn`) are pills. Outline buttons sit on `--glass-bg-subtle` with a `--glass-border-strong` edge.
- **Fields** (`.wl-input`, `.form-control`, `.form-select`) are `--radius-xl` on `--glass-bg-subtle`, keep the `border-strong` edge and the focus ring. Text areas use `--radius-lg`.
- **Page header** (`.wl-page-head`): title and one line of context on the left, the page's one action on the right.
- **States** (`.wl-state__icon`, `.wl-state__label`, `.wl-state__actions`): error, empty and done screens show a decorative icon in a glass ring, a mono label where useful ("Error 404"), a title, one sentence and the next step. One primary action at most.
- **Map fallback**: if Mapbox cannot load, `.wl-map__fallback` says so in the map's place.
- **Motion**: page content fades up 8px once (`wlPageIn`, `backwards` fill so no transform is left on the page), only under `prefers-reduced-motion: no-preference`.

### 7.12 Tag and status pill

- Tag: `surface` fill, Label style, `radius-sm`, used for category on photos.
- Status pill (Confirmed, Cancelled, Upcoming): small pill with the status colour on its `-subtle` background, an icon and a word.

### 7.13 Alerts (flash messages)

Transient messages are now pop-ups (7.13a). This section still describes the alert colours and shape they reuse, and inline status alerts on a page.

- A full-width bar inside the container below the header. Status colour on its `-subtle` background, icon, message, and a close button.
- Success auto-dismisses after 5 seconds. Errors and warnings stay until closed.
- Announced to screen readers: errors as assertive, others as polite.
- Messages are one or two short sentences. They say what happened and what to do next.

### 7.13a Pop-up notifications

- Replaces the flash bar above for every transient message. Built on the alert colours and shape, floated in a fixed container with `shadow-raised` (no other shadow, no new colour) and a `border` hairline.
- Placement: top centre on every screen size, 480px wide at most (a 32px margin each side on phones). It floats (fixed) and takes no room from the page, and it sits at the top of the viewport, narrow enough to leave the header controls beside it free. Layer: `--z-toast`.
- Stacking: at most three visible; later ones wait and appear as room opens, so none is lost.
- Timing: success and info close after 5 seconds and pause on hover and focus. Warnings and errors stay until closed.
- States: success, info, warning, error, each with its icon and the subtle fill from section 2. Colour is never the only signal.
- Accessibility: success and info are `role="status"` and polite; warning and error are `role="alert"` and assertive. The close button is 44 by 44 px, named "Dismiss notification". Escape closes the newest. Focus never moves to a pop-up. Server-rendered, so without JavaScript they show as static messages at the top of the page.
- Not pop-ups: field errors (inline, `aria-invalid`, `aria-describedby`), empty states, page status text and the email reminder banner.

### 7.13b Mode switch and sign-up choice

- **Mode switch:** one outlined (home hero: pill) button in the header beside the account menu, labelled "Switch to host" or "Switch to guest", with a repeat icon. It is a POST form with a CSRF token. A visually hidden line states the current mode.
- **Sign-up choice:** a native radio group in a fieldset with the visible legend "I want to:" and two equal options, each with a title and one plain line: "Find stays" and "List my home". Nothing is checked, and submitting without a choice shows an inline error under the group and moves focus to the first option. Options sit side by side, and stack below 420 px. The selected option is not colour alone: it has a `secondary-subtle` fill, a thicker edge, a heavier title and a check icon. The radio stays in the page, invisible, over its whole option, so the keyboard and screen readers just work. Login has no mode control.

### 7.13c Public profile

A panel with the photo (96px circle; initials on a tile when there is none), display name as the page heading, `@username`, then city and country, languages, "Member since Month Year" and an "Email verified" pill, then the bio (plain text, line breaks kept). The owner sees an "Edit profile" button. Below: "Stays hosted by ..." as stay cards with pagination, and "Reviews written by ..." with the stay name and the "Verified stay" pill where it applies. Names elsewhere (stay page host, review authors, the other party on a booking) link here.

### 7.13d Profile settings (owner only)

Below the owner's own profile, under the heading "Your settings", five panels in this order using the form field pattern: Edit profile (photo, username, display name, bio, city, country, languages; the one primary button), Contact (new email plus current password; shows a pending address), Security (active mode, Terms and Privacy acceptance date and version, change password), Your data (download), Delete account (password and typing DELETE).

### 7.14 Confirmation

Destructive actions (delete listing, cancel reservation, delete review) ask for confirmation. MVP uses the browser confirmation dialog via the existing confirm script, with a clear sentence naming the thing ("Cancel your stay at Beachfront Villa in Greece from 12 to 15 Nov?"). A custom modal is optional later and must follow section 11 and section 13 if built.

### 7.15 Map

- Base map style in a light, muted palette consistent with Stone. Pins are small `primary` circles with a `surface` ring, clusters are larger `primary` circles with a count in `on-primary`.
- Hover and selected pin: ring in `accent`.
- Popup uses the Compact stay card. Close on Escape and returns focus to the pin.
- Controls (zoom) are 44px, `surface` fill, hairline border.
- A text alternative to the map always exists: a list view link ("View as list").
- The cap notice ("Showing 500 of N stays") sits above the map in Small `text-secondary`.

### 7.16 Map band (home)

A `primary` band with `radius-md`, large display headline with one italic `accent` word, one sentence, a light pill button, and a decorative graticule drawing on the right in thin brass lines. The drawing is hidden from assistive technology.

### 7.17 Trust row (home)

Three short statements in columns, each with a mono number (01, 02, 03) in `accent`, a display title and one sentence. Content must only describe features that exist (PRD FR-6, FR-7, FR-8).

### 7.18 Tables and lists (Trips, Hosting)

Rows, not tables, on phones. Each booking row shows photo thumbnail, stay title and place, dates, total, status pill, and the Cancel action. On desktop the same row lays out in columns with a hairline between rows. No zebra striping.

### 7.18a Stat tile (Hosting)

`.wl-stat`: a surface panel with a number in the display font and a short label in `text-secondary`. Counts only. No tile is a link, so there is no hover or focus state. With no data the tile shows 0.

### 7.18b Disclosure (Help, price details)

`.wl-disclosure`: native `<details>` and `<summary>`, with a `border` hairline below each. States: closed, open (chevron turns), hover (`state-hover`), focus (focus ring). Needs no JavaScript.

### 7.18c Gallery (stay page)

`.wl-gallery`: one large photo and a row of thumbnails as real buttons, 44px or larger. The current thumbnail has `aria-pressed="true"` and a visible ring. States: one photo (no thumbnails), hover, focus. Without JavaScript the first photo still shows.

### 7.18d File preview (listing form)

`.wl-photos`: a grid of chosen photos, each with a checkbox to remove it and a radio to make it the cover. States: empty (hint text), previewing, invalid file (inline error, `aria-invalid`), busy while the form submits.

### 7.18d-2 Listing form

One long page from one partial, `views/includes/listingForm.ejs`, used by create and edit. Each section is a `.wl-form-section` panel: `surface` with a `border` hairline and `radius-md`, in this order: Basics, Location, Space, Pricing, Stay rules, Amenities and accessibility, Photos, Availability, Status. Groups are `<fieldset>` and `<legend>`. Required fields say "(required)" in text. Errors follow the form field pattern, with a summary at the top that takes focus and says how many fields to fix. Long checkbox groups (`.wl-check-cols`) are two columns from 768 px and one on phones. Each photo has a "Make cover" radio, a "Remove" box and an alt field. Status has one primary button, Publish listing or Save changes, followed by the outline Save as draft or Move to draft.

### 7.18d-3 Stay terms and policy display

The stay page has a "House rules and stay terms" panel above the two columns, so on phones it is still read before the booking panel. Times and the policy use the `.wl-facts` rows from the booking page, and rules use the amenity list with a check or a cross plus words. Only what the host stated is shown. Nothing unstated appears as "No". A policy is always its label in bold plus one plain sentence, with a link to the full page. A late cancellation is a `warning` badge reading "Late cancellation", on the booking page and in lists, for both parties. The public map shows a circle in `--primary` at low opacity with no marker.

### 7.18e Legal layout

`.wl-prose` with a contents list (`.wl-toc`) above it, and the draft notice at the top while `LEGAL_REVIEWED` is false. Placeholders appear in brackets so a missing fact stays visible. Line length stays near 70 characters. Links are underlined.

### 7.18f Email layout

`views/emails/message.ejs` and its text twin. A single column, 600px at most, limestone ground, one ink button. Hex values are allowed only here and come from `utils/emailTheme.js`, because mail clients cannot read CSS variables. Every email has a plain text version that says the same thing.

### 7.18g Admin rows

`.wl-admin-row`: main text on the left, one text button on the right, wrapping under on phones. No `primary` button: moderation is not the main action of a page. Empty states say "No open reports."

### 7.19 Skeletons

Only where content loads after the page renders (map tiles, calendar data). A skeleton is a flat `surface-sunken` block with the same size as the final content and no shimmer. Server-rendered pages need no skeleton.

---

## 8. Forms (patterns)

- One column. Fields in the order the user thinks about them. Group with a short heading, not a box.
- Validate on submit and, for individual fields, on leaving the field. Never show errors while the user is still typing in an untouched field.
- On submit failure, keep all entered values (except passwords), show a summary alert at the top ("Fix 2 fields to continue") and move focus to the first invalid field.
- Primary button text names the result ("Create account", "Publish stay"), never "Submit".
- Auth forms: Log in and Sign up link to each other under the button. Passwords can be shown with a toggle. The password rule appears as helper text before the user types it.
- Listing form sections: Basics (title, description, property type, category), Place (location, country, map pin), Price (currency, nightly price), Photo. The map pin picker sits under the address fields and says "Click the map to place the pin." Changing the address clears the pin and the form says so.
- Date entry uses the calendar component, never free typing alone.
- Money fields show the currency symbol as a fixed prefix.
- Never disable the submit button to hide a validation problem. Disable only while sending.

---

## 9. States

Behaviour for each page is defined in `PRD.md` section 10. Visual treatment:

### 9.1 Loading

- Pages are server-rendered, so the first paint is complete. No spinners for page loads.
- Images reserve space and fade in over 200ms.
- Buttons that send data show "Working…" and keep their width.
- Maps and calendars show a flat placeholder block of their final size until ready.
- Long operations (photo upload) show a text status in the field ("Uploading…").

### 9.2 Empty

An empty state is a short display-family sentence, one line of `text-secondary` explanation, and one primary or outline action. It is centred in a `surface` panel with generous padding. No illustrations or icons larger than 24px.

| Place | Headline | Support line | Action |
| --- | --- | --- | --- |
| No search results | No stays found | Try different dates, a wider price range or fewer filters. | Clear all filters |
| Saved | Nothing saved yet | Tap the heart on a stay to keep it here. | Browse stays |
| Trips | No trips yet | Stays you reserve will appear here. | Browse stays |
| Hosting | No reservations yet | When someone reserves one of your stays, you will see it here. | Create a listing |
| Reviews | No reviews yet | Be the first to share how it was. | (none, or the review form) |
| Map with no pins | No stays with a location match | Adjust your filters, or view the list. | View as list |

### 9.3 Error

| Kind | Treatment |
| --- | --- |
| Field error | Inline under the field (7.3) |
| Form or action failure | Alert at the top (7.13) with next step |
| Page not found | Full page: display headline "We couldn't find that page", one line, button "Back to stays" |
| Server error | Full page: "Something went wrong on our side", no technical detail, button to retry or go home |
| Access denied or CSRF | Plain message, "Refresh the page and try again", and a refresh link |
| Map failure | Inline message in the map area with the list link |
| Rate limited | "Too many attempts. Please wait a few minutes." |

Error copy is calm and specific. It never blames the user and never shows codes or stack traces.

---

## 10. Page-level layout guidance

All pages use the shared header, container and footer. Sections stack in the order given.

| Page | Section order |
| --- | --- |
| **Home** | Header → hero (headline, supporting sentence, search bar, "Often searched" links on the left; one large photograph with a small featured-stay card on the right) → category tabs and Filters / Map view → "Featured stays" with the feature card and a standard card, then a grid of standard cards → map band → "More to explore" compact grid → pagination → trust row → footer. |
| **Map** | Header → page title and filter bar → full-width map (height fills the viewport below the header, minimum 480px) → cap notice → list link. Pin popups use the Compact card. |
| **Stay detail** | Header → Back link → title and place line → large photo → two columns: left (facts, description, map, reviews) and right (booking panel). On phones the booking panel moves below the facts and a bar with price and "Reserve" stays at the bottom of the screen. |
| **New and Edit listing** | Header → page title → 640px form column with the sections from section 8 → actions row (primary right). |
| **Log in and Sign up** | Header → centred 420px panel on `surface` → short heading → form → link to the other form. No marketing imagery. |
| **Saved** | Header → title and count → standard card grid → pagination if needed → empty state if none. |
| **Trips and Hosting** | Header → title and short explanation → booking rows → pagination. Hosting also links to Create listing. |
| **Error pages** | Header → centred message and action → footer. |

---

## 11. Interaction and motion

Motion explains change. It is never decoration.

| Interaction | Behaviour | Duration | Easing |
| --- | --- | --- | --- |
| Photo hover in a card | Photo scales to about 103.5% inside its frame | 600ms | Gentle ease-out |
| Button hover, link hover | Colour change | 120ms | Linear |
| Arrow link hover | Arrow moves 2px right | 200ms | Ease-out |
| Menu and popover open | Fade in and move 4px | 160ms | Ease-out |
| Alert enter | Fade in | 200ms | Ease-out |
| Alert dismiss | Fade out | 150ms | Ease-in |
| Page load of images | Fade in | 200ms | Ease-out |
| Calendar range select | Instant fill, no animation | 0 | n/a |

Rules:
- Animate only opacity and small transforms. Never animate layout properties (width, height, position).
- No auto-playing, looping or scroll-triggered animation. No parallax.
- When the user prefers reduced motion, remove all transforms and fades except instant colour changes.
- Hover has no meaning on touch screens. Every hover effect has a non-hover equivalent (focus, or it is purely decorative).
- Feedback after an action is immediate: the clicked control changes state before the server responds.
- Scroll position is kept on in-page filter changes where possible, and reset to the top on page navigation.

---

## 12. Responsive behaviour

| Element | Phone (under 576) | Tablet (576 to 991) | Desktop (992 and up) |
| --- | --- | --- | --- |
| Header | Logo and Menu button | Logo and Menu button | Full navigation |
| Hero | Stacked: headline, text, search, then photo (shorter) | Stacked, larger type | Two columns: text left, photo right |
| Search bar | Fields stacked, button last | Two columns of fields | One row of four fields, button below the row |
| Category tabs | Horizontal scroll | Horizontal scroll | Wrapped row |
| Stay grids | 1 column | 2 columns | 3 columns (large grid), 4 (compact, at 1200) |
| Feature card | Same as standard, full width | Full width above the grid | Two thirds width beside a standard card |
| Stay detail | Single column with a bottom price and Reserve bar | Single column, booking panel after facts | Two columns, booking panel on the right |
| Calendar | One month | Two months | Two months |
| Map | Full width, height at least 60% of the screen | Same | Same |
| Tables | Row cards | Row cards | Columnar rows |
| Footer | Stacked groups | Two columns | Brand left, groups right |

Requirements:
- Test at 360, 390, 768, 1024, 1440 and 1920 pixels wide, and at 200% browser zoom.
- No horizontal scrolling of the page at any width.
- Tap targets at least 44px. Space between neighbouring tap targets at least 8px.
- Do not hide features on small screens. Reorder or collapse them.
- Phone form fields are 16px or larger.

---

## 13. Accessibility

Target: WCAG 2.2 AA on every page, in both themes (PRD NFR-9 to NFR-12).

- **Contrast.** Text 4.5:1, large text 3:1, control edges and focus rings 3:1. Use only token pairs recorded in the colour system. `text-muted` is allowed on `bg`, `surface` and `surface-sunken`. Brass text is not allowed on `surface-sunken`.
- **Colour independence.** Status, selected state, saved state and booked dates are never conveyed by colour alone.
- **Focus.** Every interactive element shows the focus ring (2px, 2px offset) on keyboard focus. The ring is never removed. Focus order follows visual order. After closing a menu or modal, focus returns to the control that opened it.
- **Keyboard.** All functions work without a mouse, including the calendar, the map's pin list, the star rating and the menus. Escape closes menus, popovers and the calendar.
- **Structure.** One page title (h1) per page, headings in order. Landmarks: header, nav (labelled), main, footer. A skip link is first.
- **Forms.** Every control has a visible label tied to it. Errors are tied to their field and announced. Required fields are stated in words. Autocomplete attributes are set on account and address fields.
- **Names and roles.** Use native elements. Icon-only buttons have names ("Save Beachfront Villa in Greece to your wishlist"). Links have meaningful text ("View Beachfront Villa in Greece"), not "Click here".
- **Images and maps.** Meaningful alt text for photos. The map has a list alternative. Decorative graphics are hidden from assistive technology.
- **Live updates.** Flash messages use live regions. The calendar summary line is a polite live region.
- **Motion.** Respect reduced motion. Nothing flashes more than three times a second.
- **Zoom and text size.** Layout works at 200% zoom and with enlarged text without clipped content.
- **Touch.** 44px targets, no hover-only controls, no gestures required.
- **Dark theme.** All of the above hold in Night. Photos are not dimmed.

---

## 14. Content and voice

- Plain, warm, specific. Short sentences. Active voice. No exclamation marks, no emoji, no hype.
- Name things the way travellers do: stay, trip, host, saved.
- Button labels are verbs ("Reserve", "Search stays", "Cancel reservation").
- Dates are written "12 Nov 2026" on the page and as a range "12 to 15 Nov" in compact places. Times are not shown (stays are by night).
- Prices: symbol, number with thousands separators, "/ night".
- Coordinates: degrees with two decimals and the hemisphere letter (for example 36.39°N 25.46°E).
- Do not invent social proof, scarcity or claims. Every statement on the page must be true of the product today.
- Error and empty copy follow section 9.

---

## 15. Dark theme specifics

- Same layout, components and spacing. Only tokens change.
- The primary action becomes light on dark. The focus ring becomes brass.
- Surfaces rise by getting lighter: `bg`, then `surface`, then `surface-raised`.
- Borders are more subtle: use `border` for grouping and `border-strong` only for controls.
- Never use pure black or pure white.
- Brand mark and footer keep their colours.

---

## 16. Pending decisions that change design

These are defined in `PRD.md` section 16. Until each is approved, build the default noted here.

| PRD decision | Default for design |
| --- | --- |
| D1 Redesign scope | Treat the shared header, footer and stay card as shared components used on every page |
| D2 Guests field | Decided: the search bar has a Guests cell, and it filters on capacity |
| D3 Currency selector | Decided (LD2): removed. Prices show in the listing's own currency |
| D4 Tax display | Decided (LD3): "Taxes are not included. The host will confirm any applicable taxes." |
| D5 Payments | Decided (LD1): request to book, pay at the property. The panel says so |
| D8 Photo counter | No counter on cards |
| D11 Coordinates | Show when a pin exists, otherwise place name only |

---

## 17. Definition of done for a UI change

An agent may mark a UI task complete only when every item is true.

1. Uses only tokens for colour, type, space, radius and motion. No raw hex values, no inline styles, no inline scripts.
2. Uses existing components, or a new component has been added to section 7 first.
3. Passes keyboard-only use, including a visible focus ring on every control.
4. Meets contrast in both Stone and Night.
5. Works at 360, 768, 1024 and 1440 pixels wide and at 200% zoom, with no horizontal scroll.
6. Has designed empty, loading and error states from section 9.
7. Shows no invented numbers or claims.
8. Respects reduced motion.
9. Browser console shows no content security policy or integrity errors on the changed pages.
10. Existing automated tests pass, and new behaviour has tests.
11. Changes are left uncommitted in the working tree for the owner to review.
