---
name: Heartstrings Club
description: A cozy hand-drawn sanctuary for teen heartbreak support
colors:
  bg-deep: "#1f1814"
  bg-elevated: "#2a221c"
  card-surface: "#2d231c"
  accent-warm: "#e8a860"
  accent-terracotta: "#b85a38"
  accent-sage: "#6b7b4c"
  accent-sage-deep: "#4a6b62"
  text-primary: "#fff9f0"
  text-soft: "#d4c4b0"
  text-muted: "#a89480"
  paper-cream: "#fff4e8"
  paper-muted: "#e8d4bc"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.18em"
rounded:
  sm: "14px"
  md: "22px"
  lg: "28px"
  pill: "999px"
spacing:
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.accent-warm}"
    textColor: "#ffffff"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.15rem"
  button-secondary:
    backgroundColor: "{colors.card-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.pill}"
    padding: "0.7rem 1.15rem"
  card:
    backgroundColor: "rgba(45, 35, 28, 0.82)"
    rounded: "{rounded.md}"
    padding: "1rem"
---

# Design System: Heartstrings Club

## 1. Overview

**Creative North Star: "The Golden-Hour Study Nook"**

Heartstrings Club looks and feels like a cozy illustrated room at sunset — warm terracotta walls, sage-green accents, cream paper, soft grain, and hand-drawn SVG environments. The UI is a product surface (diary, chat, letters) wrapped in a nostalgic, lo-fi illustration style. It rejects corporate SaaS polish in favor of lived-in warmth.

**Key Characteristics:**
- Warm earthy palette on deep brown backgrounds, never pure black or white
- Rounded organic containers with soft warm shadows
- Subtle film-grain texture overlays
- Fluid Framer Motion transitions with spring physics
- Original SVG room illustrations integrated into hero and letter-writing flows
- Serif display type (Cormorant Garamond) + sans body (Manrope)

## 2. Colors

A restrained palette: tinted warm neutrals with amber accent and sage secondary.

### Primary
- **Golden Amber** (#e8a860 / `--accent`): CTAs, eyebrows, status dots, warm highlights. Used sparingly for emphasis.

### Secondary
- **Terracotta Deep** (#b85a38 / `--accent-2`): Primary button gradient end, deeper warm accents.
- **Sage Olive** (#6b7b4c / `--accent-cool`): Secondary accents, equalizer bars, calm decorative elements.
- **Deep Sage** (#4a6b62 / `--accent-sage`): Rugs, illustration accents, cool balance to warm walls.

### Neutral
- **Deep Walnut** (#1f1814 / `--bg`): Page background base.
- **Elevated Bark** (#2a221c / `--bg-elevated`): Raised surfaces, header/footer shells.
- **Card Bark** (rgba(45, 35, 28, 0.82) / `--card`): Glass panels and cards with backdrop blur.
- **Cream Text** (#fff9f0 / `--text`): Primary text on dark surfaces.
- **Soft Parchment** (#d4c4b0 / `--text-soft`): Body secondary text.
- **Muted Clay** (#a89480 / `--muted`): Nav links, labels at rest.
- **Paper Cream** (#fff4e8 / `--paper`): Letter editor sheets, paper UI.

### Named Rules
**The Warm Tint Rule.** Never use pure #000 or #fff. All neutrals are tinted toward terracotta or cream.

**The One Accent Rule.** Golden amber carries emphasis on ≤15% of any screen. Sage provides secondary calm, not competing neon.

## 3. Typography

**Display Font:** Cormorant Garamond (with Georgia, serif)
**Body Font:** Manrope (with ui-sans-serif, system-ui)

**Character:** Editorial warmth for headlines; clean readable sans for UI and body. Feels vintage-modern, not corporate.

### Hierarchy
- **Display** (600, clamp(2rem, 3vw, 3.4rem), line-height 1): Page titles via `.section-title`
- **Title** (600, 1.25–2rem): Card headings, modal titles
- **Body** (400, 1rem, line-height 1.75): Descriptions, chat, diary content. Max ~75ch for long prose.
- **Label** (500, 0.75rem, letter-spacing 0.18em, uppercase): `.eyebrow` section labels

**The Serif-for-Emotion Rule.** Headlines and brand mark use serif; functional UI stays in Manrope.

## 4. Elevation

Depth is conveyed through warm soft shadows and backdrop blur, not harsh drop shadows or glassmorphism stacks.

### Shadow Vocabulary
- **Card rest** (`0 24px 60px rgba(0,0,0,0.35)`): Default `.card` elevation
- **Card hover** (`0 28px 70px rgba(0,0,0,0.42), 0 0 48px rgba(255,179,71,0.1)`): Lift on hover
- **Button primary** (`0 10px 30px rgba(240,159,85,0.25)`): Warm glow under CTAs

**The Flat-Grain Rule.** Texture (page-noise, cozy-room-grain) adds depth; avoid stacking multiple blur layers decoratively.

## 5. Components

### Buttons
- **Shape:** Fully rounded pills (`border-radius: 999px`)
- **Primary:** Gradient `#e8a860 → #b85a38`, white text, warm shadow. Class: `.soft-button-primary`
- **Secondary:** Dark bark background, warm border, cream text. Class: `.soft-button`
- **Hover:** translateY(-2px), brighter shadow, 360ms ease-drift

### Cards / Containers
- **Corner Style:** 22px rounded (organic, not sharp)
- **Background:** rgba(45, 35, 28, 0.82) with backdrop-filter blur(20px)
- **Border:** 1.5px rgba(232, 168, 96, 0.16)
- **Classes:** `.card`, `.glass-panel`, `.AnimatedCard`

### Inputs / Fields
- **Style:** 14px radius, dark bark fill, warm border
- **Focus:** Amber border + soft ring. Class: `.input-field`

### Navigation
- **Header/Footer:** Floating pill shells, warm bark background, blur
- **Nav links:** Rounded pills, muted at rest, amber tint when active

### Signature Component: Cozy Room Illustration
- Original hand-drawn SVG study nook (`CozyRoomIllustration.js`)
- Warm grain overlay, fairy-light animation, integrated hero overlays
- Letter-writing scene uses same illustration as backdrop (`DeskScene.js`)

## 6. Do's and Don'ts

### Do:
- **Do** use warm earthy CSS variables from `:root` for all new UI
- **Do** add subtle grain textures and golden-hour radial glows
- **Do** use Framer Motion with spring tokens from `lib/motion.js`
- **Do** respect `prefers-reduced-motion` for animated elements
- **Do** use inline SVG icons (FeatureIcon), never emoji as UI icons

### Don't:
- **Don't** use generic SaaS landing patterns (hero metrics, identical card grids, gradient text)
- **Don't** use cold clinical white backgrounds or corporate blue/cyan accents
- **Don't** use glassmorphism as default decoration or side-stripe accent borders
- **Don't** use pure black (#000) or pure white (#fff) for surfaces or text
- **Don't** paste reference room art directly — illustrations must be original SVG
- **Don't** use modal-first flows when inline or progressive disclosure works
