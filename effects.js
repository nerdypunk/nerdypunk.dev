(() => {
  const BOOT_LOADER_DURATION = 3000;
  const BOOT_LOADER_DISSOLVE_DURATION = 650;
  const BOOT_LOADER_PROGRESS_DURATION = 2200;
  const bootLoader = document.querySelector("[data-boot-loader]");

  if (bootLoader && document.documentElement.classList.contains("boot-seen")) {
    bootLoader.remove();
  } else if (bootLoader) {
    document.documentElement.classList.add("is-booting");

    try {
      sessionStorage.setItem("npdBootSeen", "1");
    } catch {}

    const progress = bootLoader.querySelector("[data-boot-progress]");
    const percent = bootLoader.querySelector("[data-boot-percent]");
    const progressStartedAt = performance.now();

    const setProgress = (value) => {
      const boundedValue = Math.min(100, Math.max(0, value));
      progress?.style.setProperty("--boot-progress", `${boundedValue / 100}`);
      progress?.setAttribute("aria-valuenow", `${boundedValue}`);
      if (percent) percent.textContent = `${String(boundedValue).padStart(3, "0")}%`;
    };

    const updateProgress = (now) => {
      const elapsed = now - progressStartedAt;
      const value = Math.min(100, Math.round((elapsed / BOOT_LOADER_PROGRESS_DURATION) * 100));
      setProgress(value);
      if (value < 100) window.requestAnimationFrame(updateProgress);
    };

    setProgress(0);
    window.requestAnimationFrame(updateProgress);

    window.setTimeout(() => {
      setProgress(100);
      bootLoader.classList.add("is-dissolving");
    }, BOOT_LOADER_DURATION - BOOT_LOADER_DISSOLVE_DURATION);

    window.setTimeout(() => {
      bootLoader.remove();
      document.documentElement.classList.remove("is-booting");
    }, BOOT_LOADER_DURATION);
  }

  const symbols = [
    "01", "10", "0xFF", "SYS", "RUN", "NULL", "VOID", "EXEC",
    "//", "::", ">_", "[]", "{}", "<>", "▓", "▒", "░", "起動", "電脳"
  ];

  const mobilePerformanceQuery = window.matchMedia(
    "(max-width: 760px), (max-width: 1024px) and (hover: none) and (pointer: coarse)"
  );
  const mobilePerformanceMode = mobilePerformanceQuery.matches;

  if (mobilePerformanceMode) {
    const video = document.querySelector(".video-player video");

    if (video && "IntersectionObserver" in window) {
      const videoObserver = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          const playback = video.play();
          if (playback) playback.catch(() => {});
        } else {
          video.pause();
        }
      }, { rootMargin: "80px 0px" });

      videoObserver.observe(video);
    }

    return;
  }

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
