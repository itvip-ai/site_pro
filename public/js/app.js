// Close any open row-action / export <details> menu when clicking elsewhere.
document.addEventListener('click', (e) => {
  document.querySelectorAll('details.row-actions[open], details.export-menu[open]').forEach((d) => {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});
