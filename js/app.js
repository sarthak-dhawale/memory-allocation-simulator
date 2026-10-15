// Interactive controller; memory transitions are shared with comparison simulations.
const simulation = MemoryEngine.state();

function clearSimulationViews() {
  inspectedBlockId = null;
  resetStepSimulation();
  document.getElementById("stepModeToggle").checked = false;
  document.getElementById("stepControls").classList.add("hidden");
  document.getElementById("comparisonTableBody").innerHTML =
    '<tr><td colspan="5" class="table-empty">Run a comparison to see results.</td></tr>';
  document.getElementById("comparisonSummary").innerHTML = "";
  renderComparisonCharts([]);
  renderComparisonLayouts([]);
  renderAllocationSteps(null);
}

function createMemory(blockSizes) {
  MemoryEngine.initialize(simulation, blockSizes);
  clearSimulationViews();
}
function recalculateAddresses() {
  MemoryEngine.addresses(simulation);
}
function createProcess(id, name, requestedMemory) {
  return MemoryEngine.create(simulation, id, name, requestedMemory);
}
function setAlgorithm(algorithm) {
  if (!MemoryEngine.algorithms[algorithm])
    return { success: false, message: "Invalid algorithm." };
  resetStepSimulation();
  renderAllocationSteps(null);
  MemoryEngine.apply(simulation, { type: "algorithm", algorithm }, true);
  return { success: true, algorithm };
}
function invalidateStepPreview() {
  if (
    simulation.stepSimulation.steps.length &&
    !simulation.stepSimulation.completed
  ) {
    resetStepSimulation();
    renderAllocationSteps(null);
  }
}
function allocateProcess(processId) {
  invalidateStepPreview();
  return MemoryEngine.allocate(simulation, processId);
}
function terminateProcess(processId) {
  invalidateStepPreview();
  return MemoryEngine.terminate(simulation, processId);
}
function mergeFreeBlocks() {
  invalidateStepPreview();
  return MemoryEngine.merge(simulation);
}
function requestAdditionalMemory(processId, amount) {
  invalidateStepPreview();
  return MemoryEngine.grow(simulation, processId, amount);
}
function calculateStatistics() {
  return MemoryEngine.statistics(simulation);
}
function calculateExternalFragmentation() {
  return calculateStatistics().externalFragmentation;
}
function calculateInternalFragmentation() {
  return calculateStatistics().internalFragmentation;
}
function analyzeAllocationFailure(size) {
  return MemoryEngine.analyzeFailure(simulation, size);
}
function addEvent(message) {
  MemoryEngine.apply(simulation, { type: "note", message }, true);
}
function compactMemory() {
  invalidateStepPreview();
  const result = MemoryEngine.compact(simulation);
  renderApplication();
  showNotification(
    result.success
      ? "Memory compacted. Retry waiting processes to use the contiguous space."
      : result.message,
    result.success ? "success" : "error",
  );
  return result;
}
function resetSimulation() {
  Object.assign(simulation, MemoryEngine.state());
  clearSimulationViews();
  document.getElementById("algorithmSelect").value = "first-fit";
  document.getElementById("allocationMode").value = "variable";
  document.getElementById("scenarioSelect").value = "normal";
  document.getElementById("memoryBlocks").value = SAMPLE_MEMORY.join(", ");
  document.getElementById("processForm").reset();
  clearTimeout(notificationTimer);
  document.getElementById("notification").className = "notification";
  return { success: true };
}

// UTILITY FUNCTIONS

// Converts internal algorithm names into readable names.
function formatAlgorithmName(algorithm) {
  switch (algorithm) {
    case "first-fit":
      return "First Fit";

    case "best-fit":
      return "Best Fit";

    case "worst-fit":
      return "Worst Fit";

    case "next-fit":
      return "Next Fit";

    default:
      return algorithm;
  }
}

// Prints the current memory state to the browser console.
function printMemory() {
  console.table(
    simulation.memory.map((block) => ({
      ID: block.id,
      Size: `${block.size} MB`,
      Status: block.free ? "FREE" : `Allocated to ${block.processId}`,
      Start: block.startAddress,
      End: block.endAddress,
    })),
  );
}

// Prints current process information.
function printProcesses() {
  console.table(
    simulation.processes.map((process) => ({
      PID: process.id,
      Process: process.name,
      Requested: `${process.requestedMemory} MB`,
      Allocated: `${process.allocatedMemory} MB`,
      Status: process.status,
      Block: process.blockId,
    })),
  );
}

// Prints current statistics.
function printStatistics() {
  console.table(calculateStatistics());
}

// USER INTERFACE

// SAMPLE DATA

const SAMPLE_MEMORY = [500, 800, 300, 1200];

// INITIALIZE APPLICATION

function initializeApplication() {
  // Load sample data on startup so the user has something to interact with immediately.
  createMemory(SAMPLE_MEMORY);
  restoreLocalSession();

  renderApplication();

  setupEventListeners();
  initializeWorkspace();
}

// EVENT LISTENERS
function setupEventListeners() {
  setupLabFeatures();
  setupMemoryInspector();
  setupStudioTools();
  const algorithmSelect = document.getElementById("algorithmSelect");

  algorithmSelect.addEventListener("change", handleAlgorithmChange);

  const processForm = document.getElementById("processForm");

  processForm.addEventListener("submit", handleCreateProcess);

  document
    .getElementById("allocateButton")
    .addEventListener("click", handleAllocate);

  document
    .getElementById("loadSampleButton")
    .addEventListener("click", handleLoadSample);

  document
    .getElementById("configureMemoryButton")
    .addEventListener("click", handleConfigureMemory);

  document.getElementById("resetButton").addEventListener("click", handleReset);

  document
    .getElementById("compareButton")
    .addEventListener("click", runAlgorithmComparison);

  document
    .getElementById("stepModeToggle")
    .addEventListener("change", handleStepModeToggle);

  document
    .getElementById("previousStepButton")
    .addEventListener("click", handlePreviousStep);

  document
    .getElementById("nextStepButton")
    .addEventListener("click", handleNextStep);

  document
    .getElementById("runAllButton")
    .addEventListener("click", handleRunAll);
  document
    .getElementById("compactButton")
    .addEventListener("click", compactMemory);
  document
    .getElementById("allocationMode")
    .addEventListener("change", handleModeChange);
  document
    .getElementById("loadScenarioButton")
    .addEventListener("click", loadScenario);
  document
    .getElementById("scenarioNextButton")
    .addEventListener("click", runNextScenarioAction);
  document
    .getElementById("scenarioRunButton")
    .addEventListener("click", runScenario);
  document
    .getElementById("scenarioSelect")
    .addEventListener("change", renderScenarioProgress);
}

// ALGORITHM CHANGE

function handleAlgorithmChange(event) {
  const algorithm = event.target.value;

  const result = setAlgorithm(algorithm);

  if (!result.success) {
    showNotification(result.message, "error");

    return;
  }

  showNotification(
    `Algorithm changed to ${formatAlgorithmName(algorithm)}.`,
    "success",
  );

  renderApplication();
}

// CREATE PROCESS

function handleCreateProcess(event) {
  event.preventDefault();

  const processId = document.getElementById("processId").value.trim();

  const processName = document.getElementById("processName").value.trim();

  const memory = Number(document.getElementById("memoryRequest").value);

  const result = createProcess(processId, processName, memory);

  if (!result.success) {
    showNotification(result.message, "error");

    return;
  }

  showNotification(`${processId} created successfully.`, "success");

  // Clear form
  event.target.reset();

  renderApplication();
}

// ALLOCATE

function handleAllocate() {
  const select = document.getElementById("allocationProcessSelect");

  const processId = select.value;

  if (!processId) {
    showNotification("Select a waiting process first.", "error");

    return;
  }

  if (simulation.stepMode) {
    startStepSimulation(processId);

    return;
  }

  const result = allocateProcess(processId);

  renderApplication();

  // Show algorithm reasoning
  if (result.algorithmResult) {
    renderAllocationSteps(result.algorithmResult, getProcessRequest(processId));
  }

  if (!result.success) {
    showNotification(result.message, "error");

    return;
  }

  showNotification(`${processId} allocated successfully.`, "success");
}

// TABLE ALLOCATION

function allocateFromTable(processId) {
  if (simulation.stepMode) {
    startStepSimulation(processId);
    return;
  }
  const result = allocateProcess(processId);

  renderApplication();

  if (result.algorithmResult) {
    renderAllocationSteps(result.algorithmResult, getProcessRequest(processId));
  }

  if (!result.success) {
    showNotification(result.message, "error");

    return;
  }

  showNotification(`${processId} allocated successfully.`, "success");
}

// REQUEST MORE

async function requestMoreFromTable(processId) {
  const input = await requestMemoryAmount(
    `How much additional memory should ${processId} request? (MB)`,
  );

  if (input === null) {
    return;
  }

  const amount = Number(input);

  const result = requestAdditionalMemory(processId, amount);

  renderApplication();
  if (!result.success) {
    showNotification(result.message, "error");
    return;
  }

  showNotification(
    `${processId} received ${amount} MB additional memory.`,
    "success",
  );
}

// TERMINATE

async function terminateFromTable(processId) {
  const process = simulation.processes.find((p) => p.id === processId);

  if (!process) {
    return;
  }

  const confirmed = await confirmSimulationAction(
    `Terminate ${processId} (${process.name}) and release its memory?`,
  );

  if (!confirmed) {
    return;
  }

  const result = terminateProcess(processId);

  if (!result.success) {
    showNotification(result.message, "error");

    return;
  }

  renderApplication();

  showNotification(
    `${processId} terminated and ${result.releasedMemory} MB released.`,
    "success",
  );
}
// LOAD SAMPLE

async function handleLoadSample() {
  const confirmed =
    simulation.processes.length === 0 ||
    (await confirmSimulationAction(
      "Load sample data and clear the current simulation?",
    ));

  if (!confirmed) {
    return;
  }

  document.getElementById("memoryBlocks").value = "100, 500, 200, 300, 600";
  createMemory([100, 500, 200, 300, 600]);

  // Sample workload from the project specification.
  createProcess("P1", "Process A", 212);

  createProcess("P2", "Process B", 417);

  createProcess("P3", "Process C", 112);

  createProcess("P4", "Process D", 426);

  renderApplication();

  showNotification("Sample memory and processes loaded.", "success");
}

// CONFIGURE CUSTOM MEMORY

async function handleConfigureMemory() {
  const input = document.getElementById("memoryBlocks").value.trim();

  if (!input) {
    showNotification("Enter at least one memory block.", "error");

    return;
  }

  // Convert: "500, 800, 300, 1200" into: [500, 800, 300, 1200]
  const blocks = input.split(",").map((value) => Number(value.trim()));

  // Validate every block.
  if (
    blocks.length === 0 ||
    blocks.some((size) => !Number.isFinite(size) || size <= 0)
  ) {
    showNotification(
      "Every memory block must be a number greater than 0.",
      "error",
    );

    return;
  }

  // Make sure values are whole MB values.
  if (blocks.some((size) => !Number.isInteger(size))) {
    showNotification("Memory block sizes must be whole numbers.", "error");

    return;
  }

  // Reject unsafe capacities before the engine guard throws or addresses lose precision.
  if (
    blocks.some((size) => !Number.isSafeInteger(size)) ||
    !Number.isSafeInteger(blocks.reduce((total, size) => total + size, 0))
  ) {
    showNotification(
      "Memory sizes and total capacity must be safe whole MB values (up to 9,007,199,254,740,991).",
      "error",
    );
    return;
  }

  // Don't accidentally destroy an active simulation.
  if (simulation.processes.length > 0) {
    const confirmed = await confirmSimulationAction(
      "Configuring new memory will clear the current processes. Continue?",
    );

    if (!confirmed) {
      return;
    }
  }

  createMemory(blocks);

  renderApplication();

  // Clear previous allocation explanation.
  const steps = document.getElementById("allocationSteps");

  if (steps) {
    steps.innerHTML = `
            <div class="empty-state small">
                <span>
                    Allocation decisions will appear here.
                </span>
            </div>
        `;
  }

  showNotification(
    `Memory configured: ${simulation.totalMemory} MB across ${blocks.length} partitions.`,
    "success",
  );
}

// RESET

async function handleReset() {
  const confirmed = await confirmSimulationAction(
    "Reset the simulation? All processes and allocations will be cleared.",
  );

  if (!confirmed) {
    return;
  }

  resetSimulation();

  renderApplication();

  showNotification("Simulation reset.", "success");
}

// RENDER EVERYTHING

function renderApplication() {
  const motionPositions = captureMemoryPositions();
  renderMemoryMap();

  renderProcessTable();

  renderProcessSelect();

  renderStatistics();

  renderActivityLog();
  renderAnalysisPanels();
  updateCharts();
  renderScenarioProgress();
  renderWorkspaceSummary();
  renderStudioTools();
  renderGuidedDemo();
  renderDecisionCost();
  animateMemoryChanges(motionPositions);
  persistSession();
  document.getElementById("algorithmSelect").value = simulation.algorithm;
  document.getElementById("allocationMode").value = simulation.mode;
  document.getElementById("compactButton").disabled =
    simulation.mode === "fixed" || !simulation.totalMemory;
  document.getElementById("modeDescription").textContent =
    simulation.mode === "fixed"
      ? "Fixed: one process per partition. Unused reserved space is internal fragmentation. Boundaries never merge or compact."
      : "Variable: requests split free regions. Released adjacent holes merge. Compaction makes all free memory contiguous.";
}

// UTILITY

function getProcessRequest(processId) {
  const process = simulation.processes.find((p) => p.id === processId);

  return process ? process.requestedMemory : 0;
}

// NOTIFICATIONS

let notificationTimer = null;

function showNotification(message, type = "success") {
  const notification = document.getElementById("notification");

  notification.textContent = message;

  notification.className = `notification visible ${type}`;

  clearTimeout(notificationTimer);

  notificationTimer = setTimeout(() => {
    notification.className = "notification";
  }, 3000);
}

// Replay recorded lifecycle actions plus any still-unattempted waiting requests.
function getComparisonWorkload() {
  const actions = simulation.workload
    .filter((action) => !["algorithm", "note"].includes(action.type))
    .map((action) => ({ ...action }));
  if (simulation.scenario)
    actions.push(
      ...SCENARIOS[simulation.scenario].actions.slice(
        simulation.scenarioCursor,
      ),
    );
  for (const process of simulation.processes) {
    if (
      process.status === "waiting" &&
      !actions.some((a) => a.type === "allocate" && a.id === process.id)
    )
      actions.push({ type: "allocate", id: process.id });
  }
  return actions;
}

function simulateWorkload(
  initialMemory,
  workload,
  algorithmFunction,
  mode = simulation.mode,
) {
  const state = MemoryEngine.state(mode);
  state.algorithm = Object.keys(MemoryEngine.algorithms).find(
    (key) => MemoryEngine.algorithms[key] === algorithmFunction,
  );
  if (!state.algorithm) throw new Error("Unknown comparison algorithm.");
  MemoryEngine.initialize(
    state,
    initialMemory.map((b) => b.size),
  );
  for (const action of workload) {
    if (["algorithm", "note"].includes(action.type)) continue;
    if (action.type) MemoryEngine.apply(state, action);
    else {
      MemoryEngine.create(
        state,
        action.id,
        action.name,
        action.requestedMemory,
        false,
      );
      MemoryEngine.allocate(state, action.id, false);
    }
  }
  const { attempts, successes, failures, searchOperations } = state.metrics;
  return {
    ...MemoryEngine.statistics(state),
    mode: state.mode,
    nextFitAddress: state.nextFitAddress,
    successfulAllocations: successes,
    failedAllocations: failures,
    successRate: attempts ? (successes / attempts) * 100 : 0,
    searchOperations,
    averageSearchLength: attempts ? searchOperations / attempts : 0,
    finalMemory: state.memory,
    finalProcesses: state.processes,
    events: state.events,
    compactionCount: state.compactionCount,
  };
}

function recommendAlgorithm(results) {
  const maxSearch = Math.max(...results.map((r) => r.searchOperations), 1);
  // Score out of 100: success dominates; payload use avoids rewarding fixed-partition waste.
  for (const result of results) {
    result.efficiencyScore =
      0.65 * result.successRate +
      0.15 * result.payloadUtilization +
      0.15 * (100 - result.externalFragmentationPercent) +
      5 * (1 - result.searchOperations / maxSearch);
  }
  const score = Math.max(...results.map((r) => r.efficiencyScore));
  return results.filter((r) => Math.abs(r.efficiencyScore - score) < 1e-9);
}

function runAlgorithmComparison() {
  if (!simulation.initialMemory.length || !simulation.processes.length) {
    showNotification("Configure memory and create processes first.", "error");
    return;
  }
  const workload = getComparisonWorkload();
  const results = Object.entries(MemoryEngine.algorithms).map(([key, fn]) => ({
    key,
    name: formatAlgorithmName(key),
    ...simulateWorkload(simulation.initialMemory, workload, fn),
  }));
  recommendAlgorithm(results);
  simulation.comparisonResults = results;
  simulation.comparisonStep = simulation.step;
  renderComparisonResults(results);
  showNotification(
    "Comparison completed with identical memory and lifecycle actions.",
    "success",
  );
  return results;
}

function renderComparisonResults(results) {
  const metrics = [
    ["Successful allocations / growth", "successfulAllocations"],
    ["Failed allocations / growth", "failedAllocations"],
    ["Success rate", "successRate", "%"],
    ["Reserved memory utilization", "utilization", "%"],
    ["Useful payload utilization", "payloadUtilization", "%"],
    ["Final free memory", "freeMemory", " MB"],
    ["Largest free block", "largestFreeBlock", " MB"],
    ["Free blocks", "freeBlockCount"],
    ["External fragmentation", "externalFragmentation", " MB"],
    ["External fragmentation ratio", "externalFragmentationPercent", "%"],
    ["Internal fragmentation", "internalFragmentation", " MB"],
    ["Internal fragmentation ratio", "internalFragmentationPercent", "%"],
    ["Search operations (free blocks)", "searchOperations"],
    ["Average search length", "averageSearchLength", "", true],
    ["Efficiency score / 100", "efficiencyScore", "", true],
  ];
  document.getElementById("comparisonTableBody").innerHTML = metrics
    .map(
      ([label, key, suffix = "", decimal = false]) =>
        `<tr><td>${label}</td>${results.map((r) => `<td>${suffix === "%" || decimal ? r[key].toFixed(2) : r[key]}${suffix}</td>`).join("")}</tr>`,
    )
    .join("");
  renderComparisonSummary(results);
  renderComparisonCharts(results);
  renderComparisonLayouts(results);
}

function renderComparisonSummary(results) {
  const winners = recommendAlgorithm(results);
  const best = winners[0];
  document.getElementById("comparisonSummary").innerHTML = `
        <div class="comparison-summary-title">${winners.map((r) => r.name).join(" / ")} ${winners.length > 1 ? "share the best fit for this workload." : "is the best fit for this workload."}</div>
        <p>Recommended algorithm${winners.length > 1 ? "s (tie)" : ""} · <strong>${best.efficiencyScore.toFixed(2)} / 100</strong> weighted score.</p>
        <p>${best.successRate.toFixed(1)}% successful requests · ${best.payloadUtilization.toFixed(1)}% useful utilization ·
        ${best.externalFragmentationPercent.toFixed(1)}% external fragmentation · ${best.searchOperations} free blocks examined.</p>
        <p>On this workload: ${results.map((r) => `${r.name} completed ${r.successfulAllocations} requests with ${r.failedAllocations} failures`).join("; ")}. Search effort and final fragmentation are shown in the charts above.</p>
        <details><summary>How this recommendation is calculated</summary>
        <p>Score = 65% success rate + 15% useful utilization + 15% (100 − external fragmentation ratio)
        + 5% search economy. Search economy = 100 × (1 − searches / maximum searches across algorithms).</p>
        <p>Comparison snapshot at step ${simulation.comparisonStep}. Allocation and growth attempts count toward success rate.
        Exact ties are retained. ${simulation.scenario ? "Replays recorded actions plus the remaining selected scenario actions." : "Replays recorded lifecycle actions, then attempts remaining unattempted waiting processes."}
        Fixed mode has no external fragmentation; unused reserved space reduces useful utilization.</p></details>`;
}

// STEP-BY-STEP MODE

function handleStepModeToggle(event) {
  simulation.stepMode = event.target.checked;

  const controls = document.getElementById("stepControls");

  if (simulation.stepMode) {
    controls.classList.remove("hidden");

    showNotification("Step-by-step mode enabled.", "success");
  } else {
    controls.classList.add("hidden");

    resetStepSimulation();
    renderAllocationSteps(null);
    renderScenarioProgress();

    showNotification("Step-by-step mode disabled.", "success");
  }
}

function createStepSequence(process, result) {
  const steps = [
    {
      type: "info",
      text: `${process.id} requests ${process.requestedMemory} MB.`,
    },
  ];
  if (simulation.algorithm === "next-fit")
    steps.push({
      type: "info",
      text: `Resume at address ${result.resumeAddress} MB; wrap to address 0 if needed.`,
    });
  for (const block of result.checkedBlocks)
    steps.push({
      type: "check",
      blockId: block.blockId,
      text: `${block.wrapped ? "Wrap around. " : ""}Check block ${block.blockId}: ${block.size} MB → ${block.suitable ? "Suitable" : "Too small"}.`,
    });
  if (result.success) {
    const reason = {
      "first-fit": "the first suitable free block; stop searching",
      "best-fit":
        "the smallest suitable free block after checking all free blocks",
      "worst-fit":
        "the largest suitable free block after checking all free blocks",
      "next-fit":
        "the first suitable free block from the saved search position, wrapping if needed",
    }[simulation.algorithm];
    steps.push({
      type: "selected",
      blockId: result.selectedBlockId,
      text: `Select block ${result.selectedBlockId}: ${reason}.`,
    });
    steps.push({
      type: "split",
      blockId: result.selectedBlockId,
      text:
        simulation.mode === "fixed"
          ? `Reserve the entire fixed partition; ${result.leftover} MB internal fragmentation. No split.`
          : result.leftover
            ? `Split: ${process.requestedMemory} MB allocated + ${result.leftover} MB free.`
            : "Exact fit; no split needed.",
    });
    steps.push({
      type: "success",
      text: `Commit allocation for ${process.id}.`,
    });
  } else
    steps.push({
      type: "failure",
      text: MemoryEngine.analyzeFailure(simulation, process.requestedMemory)
        .reason,
    });
  steps.push({
    type: "result",
    text: "Show the resulting memory state and updated analytics.",
  });
  return steps;
}

function startStepSimulation(processId, scenarioAction = false) {
  if (typeof window !== "undefined" && window.location.hash !== "#simulator")
    navigateTo("simulator");
  simulation.scenarioPending = scenarioAction;
  document.getElementById("memoryDetails").open = true;
  const process = simulation.processes.find((p) => p.id === processId);

  if (!process) {
    showNotification("Process not found.", "error");

    return;
  }

  if (process.status !== "waiting") {
    showNotification("Only waiting processes can start allocation.", "error");

    return;
  }

  const result = MemoryEngine.search(simulation, process.requestedMemory);

  simulation.stepSimulation = {
    steps: createStepSequence(process, result),

    currentStep: 0,

    processId,

    algorithmResult: result,
    completed: false,
  };

  updateStepControls();

  renderStepProgress();

  renderStepExplanation();

  showNotification("Step-by-step allocation started.", "success");
}

function handleNextStep() {
  const stepSimulation = simulation.stepSimulation;

  if (stepSimulation.steps.length === 0) {
    return;
  }

  if (stepSimulation.currentStep >= stepSimulation.steps.length) {
    return;
  }

  stepSimulation.currentStep++;

  renderStepProgress();

  renderStepExplanation();

  updateStepControls();

  // The final step actually performs the allocation.
  if (stepSimulation.currentStep === stepSimulation.steps.length) {
    completeStepAllocation();
  }
}

function handlePreviousStep() {
  pauseWalkthrough();
  const stepSimulation = simulation.stepSimulation;

  if (stepSimulation.currentStep <= 0) {
    return;
  }

  stepSimulation.currentStep--;

  renderStepProgress();

  renderStepExplanation();

  updateStepControls();
}

function handleRunAll() {
  pauseWalkthrough();
  const stepSimulation = simulation.stepSimulation;

  if (stepSimulation.steps.length === 0) {
    return;
  }

  stepSimulation.currentStep = stepSimulation.steps.length;

  completeStepAllocation();

  renderStepProgress();

  renderStepExplanation();

  updateStepControls();
}

function completeStepAllocation() {
  const preview = simulation.stepSimulation;
  if (preview.completed || !preview.processId) return;
  preview.completed = true;
  const result = MemoryEngine.allocate(simulation, preview.processId);
  if (simulation.scenarioPending) {
    simulation.scenarioPending = false;
    simulation.scenarioCursor++;
  }
  renderApplication();
  updateStepControls();
  showNotification(
    result.success
      ? `${preview.processId} allocated successfully.`
      : result.message,
    result.success ? "success" : "error",
  );
}

function renderStepProgress() {
  const progress = document.getElementById("stepProgress");

  if (!progress) {
    return;
  }

  const total = simulation.stepSimulation.steps.length;

  const current = simulation.stepSimulation.currentStep;

  progress.textContent = `Step ${Math.min(current, total)} / ${total}`;
}

function renderStepExplanation() {
  const container = document.getElementById("allocationSteps");

  if (!container) {
    return;
  }

  const stepSimulation = simulation.stepSimulation;

  if (stepSimulation.steps.length === 0) {
    return;
  }

  container.innerHTML = "";

  renderMemoryMap();
  highlightAddressBlock(null);
  const current = stepSimulation.steps[stepSimulation.currentStep - 1];
  if (current?.blockId && !stepSimulation.completed) {
    document
      .querySelector(`#memoryMap [data-block-id="${current.blockId}"]`)
      ?.classList.add("inspecting");
    highlightAddressBlock(current.blockId);
  }
  const visibleSteps = stepSimulation.steps.slice(
    0,
    stepSimulation.currentStep,
  );

  if (visibleSteps.length === 0) {
    container.innerHTML = `
            <div class="empty-state small">
                <span>
                    Click Next to begin.
                </span>
            </div>
        `;

    return;
  }

  visibleSteps.forEach((step, index) => {
    addStep(container, index + 1, escapeHtml(step.text));
    if (index === visibleSteps.length - 1)
      container.lastElementChild.classList.add("current-step");
  });
}

function updateStepControls() {
  const previous = document.getElementById("previousStepButton");

  const next = document.getElementById("nextStepButton");

  const runAll = document.getElementById("runAllButton");

  if (!previous || !next || !runAll) {
    return;
  }

  const stepSimulation = simulation.stepSimulation;

  const total = stepSimulation.steps.length;

  const current = stepSimulation.currentStep;

  previous.disabled = current <= 0;

  next.disabled = total === 0 || current >= total;

  runAll.disabled = total === 0 || current >= total;
  document.getElementById("playStepsButton").disabled =
    total === 0 || current >= total || !!stepSimulation.completed;
  if (current >= total) pauseWalkthrough();
}

function resetStepSimulation() {
  pauseWalkthrough();
  simulation.scenarioPending = false;
  simulation.stepSimulation = {
    steps: [],

    currentStep: 0,

    processId: null,

    algorithmResult: null,
  };

  renderStepProgress();
  updateStepControls();
  renderMemoryMap();
}

// Also support embedded browsers that execute a cached script after DOMContentLoaded.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApplication, {
    once: true,
  });
} else {
  initializeApplication();
}
