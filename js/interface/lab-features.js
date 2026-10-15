// Presentation, lesson playback, and portable workloads; engine transitions remain authoritative.
const labPlayback = { timer: null, playing: false };
let labStorageReady = false;
let labStorageMessage = "Autosave is local to this browser.";
const LAB_STORAGE_KEY = "imas-session-v1";
const GUIDED_STAGES = [
  {
    title: "Ready to allocate",
    text: "A 1,000 MB region and six requests. P6 needs 400 MB; first fill memory with the five smaller processes.",
    actions: [],
  },
  {
    title: "1 · Fill memory",
    text: "Five allocations use all 1,000 MB. Each variable allocation splits the remaining free hole.",
    actions: [1, 2, 3, 4, 5].map((i) => ({ type: "allocate", id: `P${i}` })),
  },
  {
    title: "2 · Create gaps",
    text: "Release P1, P3, and P5. There is 550 MB free, but the largest contiguous hole is only 250 MB.",
    actions: [1, 3, 5].map((i) => ({ type: "terminate", id: `P${i}` })),
  },
  {
    title: "3 · See the failure",
    text: "P6's 400 MB request fails. Total free memory is sufficient; external fragmentation prevents contiguous placement.",
    actions: [{ type: "allocate", id: "P6" }],
  },
  {
    title: "4 · Compact memory",
    text: "P2 and P4 move toward address 0. Free memory stays 550 MB, now in one contiguous hole. Compaction creates no extra memory.",
    actions: [{ type: "compact" }],
  },
  {
    title: "5 · Retry successfully",
    text: "P6 now fits. Allocated memory is 850 MB and 150 MB remains free. Its earlier failed attempt stays in history.",
    actions: [{ type: "allocate", id: "P6" }],
  },
];

function pauseWalkthrough() {
  clearTimeout(labPlayback.timer);
  labPlayback.timer = null;
  labPlayback.playing = false;
  const button = document.getElementById("playStepsButton");
  if (button) {
    button.textContent = "Play";
    button.setAttribute?.("aria-pressed", "false");
  }
}
function playWalkthrough() {
  if (labPlayback.playing) {
    pauseWalkthrough();
    return;
  }
  const preview = simulation.stepSimulation;
  if (
    !preview.steps.length ||
    preview.completed ||
    preview.currentStep >= preview.steps.length
  )
    return;
  labPlayback.playing = true;
  const tick = () => {
    if (!labPlayback.playing || simulation.stepSimulation !== preview) {
      pauseWalkthrough();
      return;
    }
    handleNextStep();
    if (preview.completed || preview.currentStep >= preview.steps.length) {
      pauseWalkthrough();
      return;
    }
    labPlayback.timer = setTimeout(
      tick,
      Number(document.getElementById("playbackSpeed").value) || 1000,
    );
  };
  document.getElementById("playStepsButton").textContent = "Pause";
  document
    .getElementById("playStepsButton")
    .setAttribute("aria-pressed", "true");
  labPlayback.timer = setTimeout(
    tick,
    Number(document.getElementById("playbackSpeed").value) || 1000,
  );
}

function captureMemoryPositions() {
  if (
    typeof window === "undefined" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
    return null;
  const positions = new Map();
  document
    .querySelectorAll("#studioCapacity [data-motion-key]")
    .forEach((element) => {
      const rect = element.getBoundingClientRect();
      positions.set(element.dataset.motionKey, rect);
      positions.set("block-" + element.dataset.blockId, rect);
    });
  return positions;
}
function animateMemoryChanges(positions) {
  if (!positions) return;
  const duration = Math.min(
    650,
    Number(document.getElementById("playbackSpeed").value) || 650,
  );
  document
    .querySelectorAll("#studioCapacity [data-motion-key]")
    .forEach((element) => {
      const before =
          positions.get(element.dataset.motionKey) ||
          positions.get("block-" + element.dataset.blockId),
        after = element.getBoundingClientRect();
      if (!after.width || !after.height) return;
      if (
        before &&
        (Math.abs(before.left - after.left) > 1 ||
          Math.abs(before.width - after.width) > 1)
      )
        element.animate(
          [
            {
              transform: `translateX(${before.left - after.left}px) scaleX(${before.width / after.width})`,
            },
            { transform: "none" },
          ],
          { duration, easing: "ease-in-out" },
        );
      else if (!before)
        element.animate(
          [
            { opacity: 0.15, transform: "scaleY(.45)" },
            { opacity: 1, transform: "none" },
          ],
          { duration, easing: "ease-out" },
        );
    });
}
function highlightAddressBlock(blockId) {
  if (typeof window === "undefined") return;
  document
    .querySelectorAll("#studioCapacity .inspecting")
    .forEach((element) => element.classList.remove("inspecting"));
  document
    .querySelectorAll(`#studioCapacity [data-block-id="${blockId}"]`)
    .forEach((element) => element.classList.add("inspecting"));
}

function beginGuidedDemo() {
  pauseWalkthrough();
  simulation.mode = "variable";
  simulation.algorithm = "first-fit";
  createMemory([1000]);
  for (const process of SCENARIOS.fragmentation.processes)
    createProcess(process.id, process.name, process.size);
  simulation.guide = { stage: 0, expectedStep: simulation.step };
  document.getElementById("memoryBlocks").value = "1000";
  renderApplication();
}
async function startGuidedDemo() {
  if (
    simulation.processes.length &&
    !(await confirmSimulationAction(
      "Start the guided demo? This replaces the current workload.",
    ))
  )
    return;
  beginGuidedDemo();
}
function advanceGuidedDemo() {
  const guide = simulation.guide;
  if (
    !guide ||
    simulation.step !== guide.expectedStep ||
    guide.stage >= GUIDED_STAGES.length - 1
  )
    return false;
  pauseWalkthrough();
  const stage = GUIDED_STAGES[guide.stage + 1];
  let latestResult = null;
  for (const action of stage.actions) {
    const result = MemoryEngine.apply(simulation, action, true);
    if (result.algorithmResult)
      latestResult = {
        result: result.algorithmResult,
        size: simulation.processes.find((p) => p.id === action.id)
          .requestedMemory,
      };
  }
  guide.stage++;
  guide.expectedStep = simulation.step;
  renderApplication();
  if (latestResult)
    renderAllocationSteps(latestResult.result, latestResult.size);
  else renderAllocationSteps(null);
  return true;
}
function renderGuidedDemo() {
  const guide = simulation.guide;
  const stale = guide && guide.expectedStep !== simulation.step;
  const stage = guide && GUIDED_STAGES[guide.stage];
  setText(
    "guidedTitle",
    stale
      ? "Workload changed · restart to continue"
      : stage?.title || "Guided fragmentation demo",
  );
  setText(
    "guidedExplanation",
    stale
      ? "The lesson stopped because memory changed outside the guided steps. Your current workload is preserved."
      : stage?.text ||
          "Follow allocation, release, failure, compaction, and a successful retry.",
  );
  const next = document.getElementById("guidedNextButton");
  next.hidden = !guide;
  next.disabled = !guide || stale || guide.stage >= GUIDED_STAGES.length - 1;
  next.textContent =
    guide && guide.stage < GUIDED_STAGES.length - 1
      ? GUIDED_STAGES[guide.stage + 1].title
      : "Lesson complete";
  setText("guidedProgress", guide ? `${guide.stage} / 5` : "");
  document.getElementById("startGuidedButton").textContent = guide
    ? "Restart demo"
    : "Start guided demo";
}

function serializeWorkload(state) {
  return {
    format: "imas-workload",
    version: 1,
    mode: state.mode,
    initialAlgorithm: state.initialAlgorithm || state.algorithm,
    memory: state.initialMemory.map((block) => block.size),
    actions: state.workload.map((action) => ({ ...action })),
    scenario: state.scenario,
    scenarioCursor: state.scenarioCursor,
  };
}
function restoreWorkload(data) {
  if (
    !data ||
    data.format !== "imas-workload" ||
    data.version !== 1 ||
    !["fixed", "variable"].includes(data.mode) ||
    !Object.hasOwn(MemoryEngine.algorithms, data.initialAlgorithm) ||
    !Array.isArray(data.memory) ||
    data.memory.length > 1000 ||
    !Array.isArray(data.actions) ||
    data.actions.length > 5000
  )
    throw new Error("Unsupported or oversized workload file.");
  const state = MemoryEngine.state(data.mode);
  state.algorithm = data.initialAlgorithm;
  if (data.memory.length) MemoryEngine.initialize(state, data.memory);
  else if (data.actions.length)
    throw new Error("Configure memory before replaying actions.");
  const positive = (size) => Number.isSafeInteger(size) && size > 0;
  for (const action of data.actions) {
    if (
      !action ||
      ![
        "create",
        "allocate",
        "terminate",
        "grow",
        "compact",
        "algorithm",
        "note",
      ].includes(action.type)
    )
      throw new Error("Unknown workload action.");
    if (
      ["create", "allocate", "terminate", "grow"].includes(action.type) &&
      (typeof action.id !== "string" ||
        !action.id.trim() ||
        action.id.length > 100)
    )
      throw new Error("Invalid process ID.");
    if (
      action.type === "create" &&
      (typeof action.name !== "string" ||
        !action.name.trim() ||
        action.name.length > 300 ||
        !positive(action.size))
    )
      throw new Error("Invalid process request.");
    if (action.type === "grow" && !positive(action.size))
      throw new Error("Invalid growth request.");
    if (
      action.type === "note" &&
      (typeof action.message !== "string" || action.message.length > 500)
    )
      throw new Error("Invalid event note.");
    if (
      action.type === "algorithm" &&
      !Object.hasOwn(MemoryEngine.algorithms, action.algorithm)
    )
      throw new Error("Invalid algorithm.");
    const result = MemoryEngine.apply(state, action, true);
    if (!result.success && !result.diagnostic)
      throw new Error(`Cannot replay ${action.type}: ${result.message}`);
  }
  if (data.scenario !== null && data.scenario !== undefined) {
    if (
      !Object.hasOwn(SCENARIOS, data.scenario) ||
      !Number.isInteger(data.scenarioCursor) ||
      data.scenarioCursor < 0 ||
      data.scenarioCursor > SCENARIOS[data.scenario].actions.length
    )
      throw new Error("Invalid scenario progress.");
    state.scenario = data.scenario;
    state.scenarioCursor = data.scenarioCursor;
  }
  return state;
}
function applyRestoredWorkload(state) {
  pauseWalkthrough();
  clearSimulationViews();
  Object.assign(simulation, state);
  document.getElementById("memoryBlocks").value = state.initialMemory
    .map((block) => block.size)
    .join(", ");
  document.getElementById("scenarioSelect").value = state.scenario || "normal";
  renderApplication();
}
function persistSession() {
  if (!labStorageReady) return;
  try {
    localStorage.setItem(
      LAB_STORAGE_KEY,
      JSON.stringify(serializeWorkload(simulation)),
    );
    labStorageMessage = "Autosaved in this browser · comparisons can be rerun.";
  } catch {
    labStorageMessage =
      "Browser storage unavailable. Download a workload to keep your work.";
  }
  setText("sessionStatus", labStorageMessage);
}
function restoreLocalSession() {
  try {
    const raw = localStorage.getItem(LAB_STORAGE_KEY);
    if (raw && raw.length <= 2000000) {
      Object.assign(simulation, restoreWorkload(JSON.parse(raw)));
      document.getElementById("memoryBlocks").value = simulation.initialMemory
        .map((b) => b.size)
        .join(", ");
      document.getElementById("scenarioSelect").value =
        simulation.scenario || "normal";
    }
  } catch {
    labStorageMessage =
      "Saved session could not be restored. Load a valid workload file to recover it.";
  }
}
function downloadLabFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importWorkloadFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2000000)
      throw new Error("Workload files must be smaller than 2 MB.");
    const state = restoreWorkload(JSON.parse(await file.text()));
    if (
      simulation.processes.length &&
      !(await confirmSimulationAction(
        "Load this workload and replace the current session?",
      ))
    )
      return;
    applyRestoredWorkload(state);
    showNotification(
      "Workload loaded. Rerun comparisons for a fresh snapshot.",
      "success",
    );
  } catch (error) {
    showNotification(`Could not load workload: ${error.message}`, "error");
  } finally {
    event.target.value = "";
  }
}

function buildSimulationReport(state) {
  const stats = MemoryEngine.statistics(state),
    e = escapeHtml;
  const rows = Object.entries(stats)
    .map(
      ([key, value]) =>
        `<tr><th>${e(key.replace(/([A-Z])/g, " $1"))}</th><td>${Number.isInteger(value) ? value : Number(value.toFixed(2))}</td></tr>`,
    )
    .join("");
  const results = state.comparisonResults || [];
  const comparison = results.length
    ? `<p>Comparison snapshot at simulation step ${state.comparisonStep}. Algorithms replay identical workloads; values can differ from the current live state.</p><table><tr><th>Algorithm</th><th>Success %</th><th>Searches</th><th>External fragmentation (MB)</th><th>Internal waste (MB)</th><th>Score / 100</th></tr>${results.map((r) => `<tr><td>${e(r.name)}</td><td>${r.successRate.toFixed(2)}</td><td>${r.searchOperations}</td><td>${r.externalFragmentation}</td><td>${r.internalFragmentation}</td><td>${r.efficiencyScore.toFixed(2)}</td></tr>`).join("")}</table><p>Score weights: 65% success, 15% useful utilization, 15% (100 − external fragmentation ratio), 5% normalized search economy.</p>`
    : "<p>No comparison has been run.</p>";
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Interactive Memory Allocation Simulator — Report</title><style>body{font:14px/1.6 system-ui;color:#0f172a;max-width:1000px;margin:40px auto;padding:0 24px}h1{font-size:27px}h2{margin-top:32px;font-size:20px}table{border-collapse:collapse;width:100%;margin:15px 0}td,th{border:1px solid #e2e8f0;padding:8px;text-align:left}th{background:#f8fafc}p{color:#52647c}@media print{body{margin:0;font-size:10pt}tr{break-inside:avoid}h2{break-after:avoid}}</style><h1>Interactive Memory Allocation Simulator</h1><p>Contiguous memory allocation simulation · ${e(state.mode)} partitioning · ${e(formatAlgorithmName(state.algorithm))} · step ${state.step}. Sizes are MB; addresses are simulated offsets.</p><h2>Configuration</h2><p>Initial regions: ${state.initialMemory.map((b) => b.size).join(", ") || "Not configured"} MB.</p><h2>Current statistics</h2><p>Memory values are MB; utilization and fragmentation ratios are percentages. Reserved utilization includes fixed-partition waste; useful utilization excludes it.</p><table>${rows}</table><h2>Memory layout</h2><table><tr><th>Start</th><th>End</th><th>Size (MB)</th><th>Owner</th></tr>${state.memory.map((b) => `<tr><td>${b.startAddress}</td><td>${b.endAddress}</td><td>${b.size}</td><td>${b.free ? "Free" : e(b.processId + " · " + b.processName)}</td></tr>`).join("")}</table>${compactionReportHtml(state.lastCompaction)}<h2>Processes</h2><table><tr><th>ID</th><th>Name</th><th>Requested (MB)</th><th>Reserved (MB)</th><th>Status</th><th>Attempts / failures</th></tr>${state.processes.map((p) => `<tr><td>${e(p.id)}</td><td>${e(p.name)}</td><td>${p.requestedMemory}</td><td>${p.allocatedMemory}</td><td>${e(p.status)}</td><td>${p.allocationAttempts} / ${p.allocationFailures}</td></tr>`).join("")}</table><h2>Algorithm comparison</h2>${comparison}<h2>Event history</h2><ol>${[
    ...state.events,
  ]
    .reverse()
    .map((event) => `<li>Step ${event.step}: ${e(event.message)}</li>`)
    .join(
      "",
    )}</ol><p>External fragmentation = free memory − largest hole in variable mode; fixed boundaries have no classical external fragmentation. Internal waste = reserved − requested in allocated processes. This simulator does not allocate real system RAM.</p></html>`;
}

function renderComparisonCharts(results) {
  const container = document.getElementById("comparisonCharts");
  container.innerHTML = results.length
    ? [
        ["Request success", "successRate", "%", 100],
        ["Free blocks examined", "searchOperations", "", null],
        ["External fragmentation", "externalFragmentation", " MB", null],
        ["Internal waste", "internalFragmentation", " MB", null],
      ]
        .map(([title, key, unit, fixedMax]) => {
          const max = fixedMax || Math.max(...results.map((r) => r[key]), 1);
          return `<article class="comparison-chart"><h3>${title}</h3>${results.map((r, i) => `<div class="compare-bar-row"><span>${eName(r.name)}</span><div class="compare-bar-track"><span style="width:${(r[key] / max) * 100}%;background:var(--p${i + 1})"></span></div><strong>${Number(r[key].toFixed(1))}${unit}</strong></div>`).join("")}</article>`;
        })
        .join("")
    : "";
}
function eName(name) {
  return escapeHtml(name);
}
function renderDecisionCost() {
  const decision = simulation.lastDecision;
  setText(
    "decisionCost",
    decision
      ? `${decision.processId} · ${decision.success ? "Allocated" : "Failed"} · ${decision.searches} free block${decision.searches === 1 ? "" : "s"} checked${decision.success ? ` · ${decision.remaining} MB ${decision.mode === "fixed" ? "internal waste" : "left over"}` : ""}`
      : "Allocate a process to see the search effort and resulting waste.",
  );
}
function setupLabFeatures() {
  document
    .getElementById("playStepsButton")
    .addEventListener("click", playWalkthrough);
  document
    .getElementById("startGuidedButton")
    .addEventListener("click", startGuidedDemo);
  document
    .getElementById("guidedNextButton")
    .addEventListener("click", advanceGuidedDemo);
  document
    .getElementById("saveWorkloadButton")
    .addEventListener("click", () => {
      persistSession();
      downloadLabFile(
        "memory-workload.json",
        JSON.stringify(serializeWorkload(simulation), null, 2),
        "application/json",
      );
    });
  document
    .getElementById("loadWorkloadButton")
    .addEventListener("click", () =>
      document.getElementById("workloadFile").click(),
    );
  document
    .getElementById("workloadFile")
    .addEventListener("change", importWorkloadFile);
  document
    .getElementById("exportReportButton")
    .addEventListener("click", () =>
      downloadLabFile(
        "memory-simulation-report.html",
        buildSimulationReport(simulation),
        "text/html",
      ),
    );
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseWalkthrough();
  });
  labStorageReady = true;
  persistSession();
}
