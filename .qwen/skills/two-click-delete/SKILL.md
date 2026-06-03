---
name: two-click-delete
description: Replace browser confirm() dialogs with an in-button two-click confirmation pattern for destructive actions
source: auto-skill
extracted_at: '2026-06-03T18:33:41.325Z'
---

# Two-Click Delete Confirmation

Replace `window.confirm()` with a self-contained, two-click pattern directly on the action button. This avoids blocking native dialogs and keeps the user in context.

## Pattern

```js
let confirmPending = false;
let confirmTimer = null;

button.addEventListener('click', () => {
  if (confirmPending) {
    clearTimeout(confirmTimer);
    confirmPending = false;
    // Perform the destructive action
    doDelete(id);
    return;
  }
  confirmPending = true;
  button.textContent = 'Confirm?';
  button.classList.add('btn-confirm-pending');
  confirmTimer = setTimeout(() => {
    confirmPending = false;
    button.textContent = 'Delete';
    button.classList.remove('btn-confirm-pending');
  }, 3000);
});
```

## Key details

- **First click**: Button text changes to "Confirm?", adds a CSS class for visual emphasis (e.g. red background).
- **Second click**: Executes the destructive action immediately.
- **Auto-reset**: A 3-second timer resets the button if the user doesn't confirm. Adjust timeout as needed.
- **Scope**: Use closure-scoped `confirmPending`/`confirmTimer` per button instance (important when rendering lists of items).

## When to use

- Deleting items from a local list
- Removing events, cards, or entries
- Any destructive action where you want to avoid `window.confirm()` / `alert()` blocking the UI

## Styling suggestion

```css
.btn-confirm-pending {
  background: #e74c3c;
  color: #fff;
}
```

## Why not `window.confirm()`?

- Native confirm dialogs block the main thread and feel disconnected from the UI.
- Two-click keeps the interaction inline, is more mobile-friendly, and gives you full visual control.
