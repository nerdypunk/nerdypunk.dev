(() => {
  const symbols = [
    "01", "10", "0xFF", "SYS", "RUN", "NULL", "VOID", "EXEC",
    "//", "::", ">_", "[]", "{}", "<>", "▓", "▒", "░", "起動", "電脳"
  ];

  const layer = document.createElement("div");
  layer.className = "code-rain";
  layer.setAttribute("aria-hidden", "true");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const columnCount = reducedMotion
    ? 8
    : Math.max(12, Math.min(28, Math.round(window.innerWidth / 62)));

  const pick = () => symbols[Math.floor(Math.random() * symbols.length)];

  for (let index = 0; index < columnCount; index += 1) {
    const column = document.createElement("span");
    const tokenCount = 12 + Math.floor(Math.random() * 16);
    const tokens = Array.from({ length: tokenCount }, pick);

    column.className = "code-rain__column";
    column.textContent = tokens.join("\n");
    column.style.setProperty("--x", `${(index + Math.random() * 0.72) * (100 / columnCount)}vw`);
    column.style.setProperty("--speed", `${15 + Math.random() * 20}s`);
    column.style.setProperty("--delay", `${-Math.random() * 28}s`);
    column.style.setProperty("--alpha", `${0.12 + Math.random() * 0.18}`);
    column.style.setProperty("--drift", `${-14 + Math.random() * 28}px`);
    column.dataset.tone = index % 5 === 0 ? "pink" : "cyan";

    if (reducedMotion) column.classList.add("is-static");
    layer.appendChild(column);
  }

  document.body.prepend(layer);
})();
