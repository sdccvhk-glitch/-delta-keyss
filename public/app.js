// Small enhancement: remember the last visited page and keep navigation lightweight.
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
    try { sessionStorage.setItem("delta:lastPage", a.getAttribute("href") || ""); } catch {}
  }));
});
