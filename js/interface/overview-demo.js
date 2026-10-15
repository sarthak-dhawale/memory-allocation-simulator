// A small independent example explains placement without changing the live simulation.
// Use the same algorithms as the engine so the explanation matches real decisions.
function renderOverviewDemo(algorithm) {
  const holes = [300, 220, 500].map((size, index) => ({
    id: index + 1,
    size,
    free: true,
  }));
  const request = 200;
  const result = MemoryEngine.algorithms[algorithm](
    holes,
    request,
    algorithm === "next-fit" ? 300 : 0,
  );
  const selected = holes.find((hole) => hole.id === result.selectedBlockId);
  document.querySelectorAll("[data-intro-algorithm]").forEach((button) => {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.introAlgorithm === algorithm),
    );
  });
  document.getElementById("introMemory").innerHTML = holes
    .map((hole) => {
      const chosen = hole.id === selected.id;
      return `<div class="intro-hole ${chosen ? "chosen" : ""}"><div class="intro-hole-label"><span>Hole ${hole.id}${algorithm === "next-fit" && hole.id === 2 ? " ↻" : ""}</span><strong>${hole.size} MB</strong></div><div class="intro-hole-bar" aria-label="Hole ${hole.id}: ${chosen ? `200 MB allocated, ${hole.size - request} MB free` : `${hole.size} MB free`}">${chosen ? `<span class="intro-allocation" style="flex:${request}">200</span>` : ""}<span class="intro-free" style="flex:${chosen ? hole.size - request : hole.size}">${chosen ? hole.size - request : hole.size}</span></div></div>`;
    })
    .join("");
  const rules = {
    "first-fit": "the first suitable hole",
    "best-fit": "the smallest suitable hole",
    "worst-fit": "the largest suitable hole",
    "next-fit": "the first suitable hole from its saved position (Hole 2)",
  };
  setText(
    "introResult",
    `${formatAlgorithmName(algorithm)} chooses ${rules[algorithm]}: ${selected.size} MB → ${selected.size - request} MB left.`,
  );
}

function setupOverviewDemo() {
  document.querySelectorAll("[data-intro-algorithm]").forEach((button) => {
    button.addEventListener("click", () =>
      renderOverviewDemo(button.dataset.introAlgorithm),
    );
  });
  renderOverviewDemo("first-fit");
}
