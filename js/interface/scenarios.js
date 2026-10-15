const scenarioProcesses = (sizes) =>
  sizes.map((size, index) => ({
    id: `P${index + 1}`,
    name: `Process ${index + 1}`,
    size,
  }));
const allocationActions = (sizes) =>
  sizes.map((_, index) => ({ type: "allocate", id: `P${index + 1}` }));
const SCENARIOS = {
  normal: {
    name: "Normal workload",
    memory: [500, 800, 300, 1200],
    description:
      "Small and medium processes, followed by release and a growth request.",
    processes: scenarioProcesses([120, 280, 180, 350, 90]),
    actions: [
      ...allocationActions([120, 280, 180, 350, 90]),
      { type: "terminate", id: "P2" },
      { type: "grow", id: "P1", size: 50 },
    ],
  },
  fragmentation: {
    name: "Fragmentation stress test",
    memory: [1000],
    description:
      "Fill memory, release alternate regions, then request 400 MB. In variable mode: 550 MB free, largest hole 250 MB. Compact and retry P6.",
    processes: scenarioProcesses([250, 200, 250, 250, 50, 400]),
    actions: [
      ...allocationActions([250, 200, 250, 250, 50]),
      { type: "terminate", id: "P1" },
      { type: "terminate", id: "P3" },
      { type: "terminate", id: "P5" },
      { type: "allocate", id: "P6" },
    ],
  },
  large: {
    name: "Large process workload",
    memory: [300, 400, 500],
    description:
      "Large requests reveal both partition limits and insufficient total memory.",
    processes: scenarioProcesses([700, 480, 600, 1400]),
    actions: allocationActions([700, 480, 600, 1400]),
  },
  mixed: {
    name: "Mixed workload",
    memory: [400, 700, 200, 900],
    description: "Small, medium, and large requests with release and growth.",
    processes: scenarioProcesses([60, 350, 650, 120, 780, 200]),
    actions: [
      ...allocationActions([60, 350, 650, 120, 780, 200]),
      { type: "terminate", id: "P2" },
      { type: "grow", id: "P1", size: 80 },
    ],
  },
  comparison: {
    name: "Algorithm comparison",
    memory: [100, 500, 200, 300, 600],
    description:
      "Classic 212, 417, 112, 426 MB requests highlight different placement choices.",
    processes: scenarioProcesses([212, 417, 112, 426]),
    actions: allocationActions([212, 417, 112, 426]),
  },
};

async function handleModeChange(event) {
  const mode = event.target.value;
  if (
    simulation.processes.length &&
    !(await confirmSimulationAction(
      "Changing partition mode clears all processes and results. Continue?",
    ))
  ) {
    event.target.value = simulation.mode;
    return;
  }
  const sizes = simulation.initialMemory.map((b) => b.size);
  simulation.mode = mode;
  if (sizes.length) createMemory(sizes);
  else {
    Object.assign(simulation, MemoryEngine.state(mode));
    clearSimulationViews();
  }
  renderApplication();
}

async function loadScenario() {
  const key = document.getElementById("scenarioSelect").value;
  const scenario = SCENARIOS[key];
  if (
    simulation.processes.length &&
    !(await confirmSimulationAction(
      "Load this scenario and clear the current simulation?",
    ))
  )
    return;
  createMemory(scenario.memory);
  simulation.scenario = key;
  document.getElementById("memoryBlocks").value = scenario.memory.join(", ");
  for (const process of scenario.processes)
    createProcess(process.id, process.name, process.size);
  renderApplication();
  showNotification(
    `${scenario.name} loaded. Run actions or allocate processes manually.`,
  );
}

function runNextScenarioAction() {
  if (!simulation.scenario || simulation.scenarioPending) return false;
  const scenario = SCENARIOS[simulation.scenario];
  const action = scenario.actions[simulation.scenarioCursor];
  if (!action) return false;
  const process = simulation.processes.find((p) => p.id === action.id);
  if (
    action.type === "allocate" &&
    process?.status === "waiting" &&
    simulation.stepMode
  ) {
    startStepSimulation(action.id, true);
    renderScenarioProgress();
    return false;
  }
  invalidateStepPreview();
  const result = MemoryEngine.apply(simulation, action, true);
  simulation.scenarioCursor++;
  if (result.algorithmResult)
    renderAllocationSteps(result.algorithmResult, process.requestedMemory);
  if (!result.success && !result.diagnostic)
    addEvent(`Scenario action ${action.type} ${action.id}: ${result.message}`);
  renderApplication();
  return true;
}

function runScenario() {
  while (runNextScenarioAction()) {
    /* Step mode pauses at each allocation preview. */
  }
}

function renderScenarioProgress() {
  const scenario = SCENARIOS[simulation.scenario];
  const selected = SCENARIOS[document.getElementById("scenarioSelect").value];
  setText(
    "scenarioDescription",
    scenario ? scenario.description : selected.description,
  );
  const action = scenario?.actions[simulation.scenarioCursor];
  setText(
    "scenarioProgress",
    scenario
      ? `${simulation.scenarioCursor} / ${scenario.actions.length} actions completed${action ? ` · Next: ${action.type} ${action.id || "memory"}${action.size ? ` +${action.size} MB` : ""}` : " · Complete"}${simulation.scenarioPending ? " · Finish allocation steps to continue" : ""}`
      : "Load a scenario to begin its lifecycle workload.",
  );
  document.getElementById("scenarioNextButton").disabled =
    !action || !!simulation.scenarioPending;
  document.getElementById("scenarioRunButton").disabled =
    !action || !!simulation.scenarioPending;
}
