---
name: domora-auth-design-system
source: derived
character: "Domora feels calm, clear, and neighborly. Teal accents and warm near white surfaces make the private account flow feel steady without looking like a property management portal."
tokens: "Real values live in src/index.css and tailwind.config.js. Read them there, do not duplicate them here."
contrast: "Body text 10.25:1 light and 13.82:1 dark. Primary text 15.50:1 light and 16.82:1 dark. Meaningful muted text 5.39:1 light and 10.46:1 dark. Text on the accent 5.47:1 light and 6.85:1 dark. Control borders 3.82:1 light and 3.66:1 dark."
---

## Build mandate

Every page is a complete product surface with Domora branding, useful copy, a clear layout, and visible loading and error states. Do not leave a form floating on an empty page.

## Character and direction

Keep the tone warm and direct. Use a simple text wordmark, softly layered surfaces, and teal only for meaningful actions and focus.

## Composition patterns

Authentication screens use one centered card no wider than the design token allows. The card contains the page title, brief context, the complete form, and its related route link. A quiet branded header and a short footer give the screen context without adding a separate welcome page.

Role pages use the same centered surface, show only the user's name, role, optional society, and logout action.

## Component and usage rules

Use the CSS variables in src/index.css through the Tailwind theme. Keep spacing on the four pixel rhythm, surfaces distinct with a border and restrained shadow, and primary color for the main action only. Keep labels visible and errors next to the field they describe.

## Responsive and accessibility direction

Start at a narrow screen, keep controls at least 48 pixels high, and let the card use the available width with safe page padding. Preserve visible keyboard focus, semantic headings, one main landmark, and reduced motion support.
