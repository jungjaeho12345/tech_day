Result: blocked (partial)
Iterations: 0 (analysis-only)
Files edited:
  - none — recommended selective update: `npx jest src/components/__tests__/Hero.test.jsx src/components/__tests__/Card.test.jsx -u`
Tests still failing:
  - Modal matches snapshot — diff includes an aria-label removal not declared by the user (a11y regression risk)
Next move: confirm intent on Modal aria-label removal before any -u; if accidental, restore aria-label or use aria-labelledby pointing at the h2 title.
