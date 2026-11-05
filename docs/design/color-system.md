# Wanderlust

Stays worth the journey.

This is the colour system for Wanderlust, a travel and accommodation platform. It is one palette in two themes, **Stone** (light) and **Night** (dark), built to read as a quiet hospitality brand rather than a software product. Photography carries the colour; the interface stays out of its way.

## Principles

1. **Neutrals do the work.** Roughly 90% of any screen is stone, ink and their tints. Colour appears where it means something: one action, one accent, one status.
2. **Taken from the places, not the trend.** The hues come from the things travellers actually see: limestone, deep water, lichen on old stone, polished brass, burnt clay, pine. No blue-violet, no gradients, no neon.
3. **Dark is a different room, not an inversion.** Night keeps the same character: the primary action flips to stone, the accent brightens to brass, and every surface is a blackened teal rather than grey.
4. **Accessible by construction.** Every text pairing below was measured. Body and label text meets AA (4.5:1) in both themes; most of it is far above.

## Palette: Light (Stone)

| Role | Token | Hex | Notes |
| --- | --- | --- | --- |
| Background | `bg` | `#F1EFE9` | Limestone. Page ground. |
| Surface / card | `surface` | `#FBFAF7` | Cards, search bar, panels |
| Raised surface | `surface-raised` | `#FFFEFB` | Menus, popovers |
| Sunken surface | `surface-sunken` | `#E8E5DC` | Wells, input fill, table headers |
| Border | `border` | `#D9D6CC` | Hairlines and dividers (decorative) |
| Border, strong | `border-strong` | `#8A8678` | Input and control edges (3.2:1) |
| **Primary** | `primary` | `#0E2B29` | Deep lagoon ink. Main action. 13.1:1 on bg |
| Primary hover | `primary-hover` | `#1B403D` | |
| Primary pressed | `primary-pressed` | `#071918` | |
| On primary | `on-primary` | `#F1EFE9` | Text on primary fill |
| **Secondary** | `secondary` | `#44605A` | Lichen. 6.0:1 on bg |
| Secondary hover | `secondary-hover` | `#33493F` | |
| Secondary subtle | `secondary-subtle` | `#E2E9E5` | Selected rows, active tabs |
| **Accent** | `accent` | `#8A6420` | Brass. 4.7:1 on bg, 5.1:1 on surface |
| Accent hover | `accent-hover` | `#6F4F18` | |
| Accent fill | `accent-fill` | `#C9A45C` | Solid brass; ink text on it is 7.5:1 |
| Accent subtle | `accent-subtle` | `#EFE4CC` | |
| **Success** | `success` | `#2C6A48` | Pine. 5.6:1 |
| Success subtle | `success-subtle` | `#E3EEE6` | |
| **Warning** | `warning` | `#8F5200` | Burnt amber. 5.4:1 |
| Warning subtle | `warning-subtle` | `#F5E7D0` | |
| **Error** | `error` | `#9B2C27` | Oxblood. 6.6:1 |
| Error subtle | `error-subtle` | `#F4DEDA` | |
| Link | `link` | `#1B5E58` | 6.6:1 |
| Link hover | `link-hover` | `#0E2B29` | |
| Info subtle | `info-subtle` | `#DDEAE7` | |
| **Text, primary** | `text` | `#111B1A` | 15.3:1 on bg |
| **Text, secondary** | `text-secondary` | `#3E4A47` | 8.0:1 |
| **Text, muted** | `text-muted` | `#5A6562` | 5.3:1 on bg, 5.8:1 on surface |
| Text, disabled | `text-disabled` | `#8F9692` | Exempt from contrast |
| Hover overlay | `state-hover` | `#111B1A` at 4% | |
| Pressed overlay | `state-pressed` | `#111B1A` at 8% | |
| **Focus ring** | `focus-ring` | `#0E2B29` | 2px ring, 2px offset. 13.1:1 |
| Scrim | `scrim` | `#0A1312` at 60% | |

## Palette: Dark (Night)

| Role | Token | Hex | Notes |
| --- | --- | --- | --- |
| Background | `bg` | `#0A1312` | Blackened teal, never pure black |
| Surface / card | `surface` | `#101C1B` | |
| Raised surface | `surface-raised` | `#162625` | Menus, popovers |
| Sunken surface | `surface-sunken` | `#0D1817` | |
| Border | `border` | `#26332F` | |
| Border, strong | `border-strong` | `#5B6A65` | 3.3:1 on bg |
| **Primary** | `primary` | `#EDE9DF` | Stone. The action flips to light. 15.5:1 |
| Primary hover | `primary-hover` | `#F7F4EC` | |
| Primary pressed | `primary-pressed` | `#D8D3C6` | |
| On primary | `on-primary` | `#0A1312` | |
| **Secondary** | `secondary` | `#9DBBB2` | 9.1:1 |
| Secondary hover | `secondary-hover` | `#B6D0C8` | |
| Secondary subtle | `secondary-subtle` | `#15292A` | |
| **Accent** | `accent` | `#D3A85A` | Brass. 8.5:1 |
| Accent hover | `accent-hover` | `#E3BF7C` | |
| Accent fill | `accent-fill` | `#D3A85A` | |
| Accent subtle | `accent-subtle` | `#2A2314` | |
| **Success** | `success` | `#6DB88E` | 8.0:1 |
| Success subtle | `success-subtle` | `#14291F` | |
| **Warning** | `warning` | `#E8903C` | 7.6:1 |
| Warning subtle | `warning-subtle` | `#2E2113` | |
| **Error** | `error` | `#E57F76` | 6.8:1 |
| Error subtle | `error-subtle` | `#2E1816` | |
| Link | `link` | `#8FCBC1` | 10.3:1 |
| Link hover | `link-hover` | `#C6E4DE` | |
| Info subtle | `info-subtle` | `#12292A` | |
| **Text, primary** | `text` | `#F1EFE9` | 16.4:1 on bg |
| **Text, secondary** | `text-secondary` | `#C2CBC7` | 11.4:1 |
| **Text, muted** | `text-muted` | `#8E9B96` | 6.5:1 on bg, 6.1:1 on surface |
| Text, disabled | `text-disabled` | `#5E6B67` | Exempt from contrast |
| Hover overlay | `state-hover` | `#F1EFE9` at 6% | |
| Pressed overlay | `state-pressed` | `#F1EFE9` at 10% | |
| **Focus ring** | `focus-ring` | `#D3A85A` | Brass. 8.5:1 |
| Scrim | `scrim` | `#000000` at 60% | |

## Why these colours

**Primary, deep lagoon ink (`#0E2B29`).** A teal taken almost to black. It reads as water at night or a shaded courtyard pool, which is travel without a palm tree. Because it is nearly neutral it looks as at home on a button as on a footer, and it gives a luxury-hospitality weight where a typical product would reach for blue. At 13:1 against the stone ground it is the strongest thing on the page, which is what a single main action should be.

**Background, limestone (`#F1EFE9`).** A warm, slightly green-grey stone, not cream and not white. Photography looks richer on it than on pure white, and long reading is easier on the eye. Cards step lighter (`#FBFAF7`), so depth comes from tone, not shadow.

**Secondary, lichen (`#44605A`).** A grey-green that sits between the ink and the stone. It handles everything that should be present but not loud: secondary buttons, selected filters, supporting icons. Being close in hue to the primary, it never competes with it.

**Accent, brass (`#8A6420`, brighter `#D3A85A` in dark).** The colour of keys, taps, lamps and compass instruments. It is the memory of the old hotel. Used in under 5% of a screen, for italic emphasis in headlines, coordinates, rules and ratings, it signals care. Used as a large fill it would turn gaudy, so large fills use the lighter `accent-fill` and stay rare.

**Status colours, pine, burnt amber, oxblood.** All three are desaturated and slightly darkened so they sit inside the palette and never look like system alerts. Amber is deliberately more orange and darker than brass, so warning and accent are never confused. Every status also carries an icon and a label; colour is never the only signal.

**Night theme.** Surfaces are teal-tinted, not neutral grey, so the brand keeps its hue after dark. The primary action inverts to stone, which is the clearest way to keep one dominant button on a dark screen. Brass takes over as the focus colour because it stands out strongly against teal-black.

## Usage guidelines

**Proportion.** Aim for about 60% ground (`bg`, `surface`), 30% text and ink, 8% photography-adjacent structure (`secondary`, `primary` fills), 2% brass.

**One primary per view.** A screen has one `primary` button: Search stays, Reserve, Log in. Everything else is secondary, outline or text. If two actions compete, one of them is not primary.

**Hierarchy of text.** Headings and prices use `text`; descriptions and labels use `text-secondary`; captions, coordinates and helper text use `text-muted`. Never put `text-muted` on photography or on `surface-sunken` below 14px.

**Brass.** Allowed: italic headline emphasis, ratings, numerals, hairline rules, coordinates marks, map pins. Not allowed: body text, buttons, backgrounds larger than a badge, and any text on `surface-sunken` (it falls under AA there).

**Borders.** `border` is a hairline for grouping. Any control edge the user must find (inputs, checkboxes, toggles) uses `border-strong`.

**States.** Hover on a filled button uses its `-hover` colour. Hover on ghost items, rows and nav uses the `state-hover` overlay. Pressed uses `-pressed` or `state-pressed`. Selected uses `secondary-subtle` with `text`, never colour alone: add a weight change, an underline or a check.

**Focus.** Every interactive element shows a 2px `focus-ring` with a 2px `focus-offset` gap, on `:focus-visible`. In light it is the ink colour; in dark it is brass. Never use `outline: none` without a replacement.

**Status.** Pair each status colour with its `-subtle` background for alerts and pills (they meet 5:1 together), plus an icon and a text label. Use `error` for destructive actions, not for emphasis.

**Gradients and effects.** None in the interface. A single dark scrim (`scrim`) is allowed behind text on photography. No glassmorphism, no glows, no coloured shadows.

**Photography.** Choose photographs with warm, natural light and calm composition. Avoid heavily saturated or filtered images, which fight the palette. Let photographs be the most colourful thing on the screen.

**Cross-platform.** Use the token names unchanged on web (`--bg`, `--primary`), iOS and Android. Do not hard-code hex values in components. Marketing materials use the same two themes: Stone for print and email, Night for hero bands, event screens and footers.

**Dark theme switch.** Apply `data-theme="dark"` on the root element. Components must reference tokens only, so nothing else changes.

## Applying it on the web

```css
:root, [data-theme="light"] {
  --bg: #F1EFE9; --surface: #FBFAF7; --surface-sunken: #E8E5DC;
  --border: #D9D6CC; --border-strong: #8A8678;
  --text: #111B1A; --text-secondary: #3E4A47; --text-muted: #5A6562;
  --primary: #0E2B29; --primary-hover: #1B403D; --on-primary: #F1EFE9;
  --secondary: #44605A; --accent: #8A6420;
  --success: #2C6A48; --warning: #8F5200; --error: #9B2C27;
  --focus-ring: #0E2B29;
}
[data-theme="dark"] {
  --bg: #0A1312; --surface: #101C1B; --surface-sunken: #0D1817;
  --border: #26332F; --border-strong: #5B6A65;
  --text: #F1EFE9; --text-secondary: #C2CBC7; --text-muted: #8E9B96;
  --primary: #EDE9DF; --primary-hover: #F7F4EC; --on-primary: #0A1312;
  --secondary: #9DBBB2; --accent: #D3A85A;
  --success: #6DB88E; --warning: #E8903C; --error: #E57F76;
  --focus-ring: #D3A85A;
}
:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }
```

The full token list, including subtle fills, hover overlays and links, is in `tokens.json`.

## Companion tokens

These match the homepage redesign. They are optional if you only need colour.

### Type

| Role | Family | Use |
| --- | --- | --- |
| Display | Instrument Serif (Georgia fallback) | Headlines, stay titles, prices in editorial contexts |
| Sans | Geist (system-ui fallback) | Body text, controls, navigation |
| Mono | Geist Mono | Labels, coordinates, small caps-style captions |

| Style | Size / line height | Weight | Notes |
| --- | --- | --- | --- |
| `display-xl` | 92px / 0.96 | 400 | Letter-spacing -0.025em |
| `display-md` | 56px / 1.0 | 400 | Letter-spacing -0.02em |
| `title` | 30px / 1.1 | 400 | Letter-spacing -0.01em |
| `body` | 16px / 1.6 | 400 | |
| `body-strong` | 16px / 1.5 | 600 | |
| `label` | 12px / 1.4 | 400 | Mono, uppercase, letter-spacing 0.14em |

### Spacing

| Token | Value |
| --- | --- |
| `space-1` | 8px |
| `space-2` | 16px |
| `space-3` | 32px |
| `space-4` | 64px |

### Radius

| Token | Value | Use |
| --- | --- | --- |
| `radius-sm` | 3px | Tags and category labels |
| `radius-md` | 4px | Photographs, cards, feature bands |
| `radius-lg` | 8px | Search bar and input panels |
| `radius-pill` | 999px | Buttons, filter pills, save buttons |

## Contrast reference

Ratios are WCAG 2 contrast measured on the colour pairs below.

| Pair | Light | Dark |
| --- | --- | --- |
| `text` on `bg` | 15.3:1 | 16.4:1 |
| `text-secondary` on `bg` | 8.0:1 | 11.4:1 |
| `text-muted` on `bg` | 5.3:1 | 6.5:1 |
| `text-muted` on `surface` | 5.8:1 | 6.1:1 |
| `text-muted` on `surface-sunken` | 4.8:1 | n/a (not used) |
| `accent` on `bg` | 4.7:1 | 8.5:1 |
| `accent` on `surface-sunken` | 4.3:1 (fails AA, avoid) | n/a |
| `secondary` on `bg` | 6.0:1 | 9.1:1 |
| `success` on `bg` | 5.6:1 | 8.0:1 |
| `warning` on `bg` | 5.4:1 | 7.6:1 |
| `error` on `bg` | 6.6:1 | 6.8:1 |
| `link` on `bg` | 6.6:1 | 10.3:1 |
| `on-primary` on `primary` | 13.1:1 | 15.5:1 |
| `on-secondary` on `secondary` | 6.6:1 | 9.1:1 |
| `focus-ring` on `bg` | 13.1:1 | 8.5:1 |
| `border-strong` on `bg` | 3.2:1 | 3.3:1 |
