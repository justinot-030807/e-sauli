# E-Sauli design

E-Sauli is a campus lost-and-found app. Its main surfaces help students scan reports, identify their items, and complete a handover.

## Color and type

Use the light and dark tokens in [constants/theme.ts](constants/theme.ts). The light theme uses maroon for primary actions, gold for accents, a warm off-white background, and white surfaces. The dark theme uses the same gold, a lighter maroon for actions, and warm dark surfaces. Use primary and secondary text tokens for readable copy. Pair status colors with a text label.

Use the platform system font and the existing size scale of 12, 14, 16, 18, 22, 28, and 34. The feed uses 22-point screen headings, 16-point item titles, and 12-point metadata. Reuse Ionicons for search, categories, and actions.

## Spacing and layout

Use the shared 4, 8, 16, 24, 32, and 48 spacing scale and existing radius tokens. Keep touch targets at least 44 points in the feed. Allow titles, filter choices, and section labels to wrap when needed. Cap the feed width on large screens and keep the filter sheet scrollable when space is limited.

Keep search and filtering available during loading, empty, and error states. Label sample data clearly when the demo is active.
