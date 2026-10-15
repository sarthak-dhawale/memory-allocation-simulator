// Read-only predictions use the same placement algorithms as committed allocations.
function inspectRequest(state, size) {
  if (!Number.isSafeInteger(size) || size <= 0)
    return { kind: "invalid", choices: [] };
  const stats = MemoryEngine.statistics(state);
  const choices = Object.keys(MemoryEngine.algorithms).map((algorithm) => {
    const result = MemoryEngine.search(state, size, algorithm);
    const block = state.memory.find(
      (block) => block.id === result.selectedBlockId,
    );
    return {
      algorithm,
      success: result.success,
      blockId: block?.id ?? null,
      startAddress: block?.startAddress ?? null,
      size: block?.size ?? 0,
      remaining: block ? block.size - size : 0,
      searches: result.checkedBlocks.length,
      resumeAddress: result.resumeAddress,
    };
  });
  const kind = !state.totalMemory
    ? "unconfigured"
    : choices.some((choice) => choice.success)
      ? "fits"
      : MemoryEngine.analyzeFailure(state, size).kind;
  return {
    kind,
    choices,
    freeMemory: stats.freeMemory,
    largestFreeBlock: stats.largestFreeBlock,
    suitableCount: state.memory.filter(
      (block) => block.free && block.size >= size,
    ).length,
  };
}

function setupStudioTools() {
  document
    .getElementById("allocationProcessSelect")
    .addEventListener("change", renderStudioTools);
  document.getElementById("previewRequest").addEventListener("input", () => {
    renderRequestInspector();
    renderMemoryInspector();
  });
}

function renderStudioTools() {
  const waiting = simulation.processes.filter(
    (process) => process.status === "waiting",
  );
  const selected = document.getElementById("allocationProcessSelect").value;
  setText("waitingCount", `${waiting.length} waiting`);
  const queue = document.getElementById("waitingQueue");
  queue.innerHTML = "";
  if (!waiting.length)
    queue.innerHTML =
      "<p>No waiting requests. Create a process or load a sample.</p>";
  waiting.forEach((process) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `queue-request${selected === process.id ? " selected" : ""}`;
    button.style.setProperty("--proc-color", getProcessColorVar(process.id));
    button.innerHTML = `<strong>${escapeHtml(process.id)}</strong><span>${process.requestedMemory} MB</span>`;
    button.title = `${process.name} · Inspect ${process.id}'s request`;
    button.addEventListener("click", () => {
      document.getElementById("allocationProcessSelect").value = process.id;
      renderStudioTools();
    });
    queue.appendChild(button);
  });
  renderRequestInspector();
  renderMemoryInspector();
}

function renderRequestInspector() {
  const selected = document.getElementById("allocationProcessSelect").value;
  const process = simulation.processes.find(
    (process) => process.id === selected && process.status === "waiting",
  );
  const input = document.getElementById("previewRequest");
  if (process) input.value = process.requestedMemory;
  input.disabled = !!process;
  setText(
    "previewContext",
    process
      ? `${process.id} · ${process.name}. Clear the process selection to try a custom request.`
      : "Try a size or select a waiting process. Preview only; memory stays unchanged.",
  );
  const result = inspectRequest(simulation, Number(input.value));
  const messages = {
    invalid: "Enter a positive whole number of MB.",
    unconfigured: "Configure memory to inspect a request.",
    "insufficient-memory": `Needs ${Number(input.value)} MB; only ${result.freeMemory} MB is free. Release memory or reduce the request. Compaction cannot help.`,
    "partition-limit":
      "No free fixed partition is large enough. Use a larger partition; compaction cannot change fixed boundaries.",
    "external-fragmentation": `Enough total free memory (${result.freeMemory} MB), but the largest hole is ${result.largestFreeBlock} MB. Compact memory, then retry.`,
  };
  const message = document.getElementById("requestFeasibility");
  message.textContent =
    result.kind === "fits"
      ? `${result.suitableCount} suitable ${simulation.mode === "fixed" ? "partition" : "hole"}${result.suitableCount === 1 ? "" : "s"} for this request.`
      : messages[result.kind];
  message.className = `request-feasibility ${result.kind === "fits" ? "fits" : "blocked"}`;
  document.getElementById("requestChoices").innerHTML = [
    "invalid",
    "unconfigured",
  ].includes(result.kind)
    ? ""
    : result.choices
        .map(
          (choice) =>
            `<div class="request-choice${choice.algorithm === simulation.algorithm ? " current" : ""}"><div><strong>${formatAlgorithmName(choice.algorithm)}</strong>${choice.algorithm === simulation.algorithm ? '<span class="choice-active">Active</span>' : ""}</div>
        <p>${choice.success ? `Block ${choice.blockId} · ${choice.size} MB` : "No suitable block"}</p>
        <span>${choice.success ? `${choice.remaining} MB ${simulation.mode === "fixed" ? "internal waste" : "leftover hole"} · ` : ""}${choice.algorithm === "next-fit" ? `Resume at ${choice.resumeAddress} MB · ` : ""}${choice.searches} free ${choice.searches === 1 ? "block" : "blocks"} checked</span></div>`,
        )
        .join("");
}
