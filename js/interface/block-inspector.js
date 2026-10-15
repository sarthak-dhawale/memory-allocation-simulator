// Inspect live engine data without allocating or changing the selected algorithm.
let inspectedBlockId = null;

function describeMemoryBlock(state, blockId) {
  const index = state.memory.findIndex((block) => block.id === blockId);
  if (index < 0) return null;
  const block = state.memory[index];
  if (block.free)
    return { ...block, kind: "free", payload: 0, waste: 0, growthCapacity: 0 };
  const process = state.processes.find(
    (process) => process.id === block.processId,
  );
  let growthCapacity =
    state.mode === "fixed" ? block.size - process.requestedMemory : 0;
  if (state.mode === "variable") {
    for (
      let i = index + 1;
      i < state.memory.length && state.memory[i].free;
      i++
    )
      growthCapacity += state.memory[i].size;
  }
  return {
    ...block,
    kind: "allocated",
    payload: process.requestedMemory,
    waste: block.size - process.requestedMemory,
    growthCapacity,
    process: { ...process },
  };
}

function inspectMemoryBlock(blockId) {
  inspectedBlockId = describeMemoryBlock(simulation, blockId) ? blockId : null;
  renderMemoryInspector();
}
function clearMemoryInspector(returnFocus = false) {
  const previous = inspectedBlockId;
  inspectedBlockId = null;
  renderMemoryInspector();
  if (returnFocus && typeof window !== "undefined")
    document
      .querySelector(`#studioCapacity [data-block-id="${previous}"]`)
      ?.focus();
}

function renderMemoryInspector() {
  const panel = document.getElementById("memoryInspector");
  const block = describeMemoryBlock(simulation, inspectedBlockId);
  if (!block) {
    inspectedBlockId = null;
    panel.innerHTML =
      '<p class="inspector-hint">Select a segment to inspect its addresses, useful memory, and growth capacity.</p>';
  } else {
    const request = Number(document.getElementById("previewRequest").value);
    const fit = Number.isSafeInteger(request) && request > 0;
    const title = block.free
      ? `Free block ${block.id}`
      : `${block.processId} · ${block.processName}`;
    panel.innerHTML = `<div class="block-inspector-heading"><strong>${escapeHtml(title)}</strong><button id="closeBlockInspector" type="button" aria-label="Close memory details" class="icon-button">×</button></div>
            <dl class="block-facts"><div><dt>Address range</dt><dd>${block.startAddress}–${block.endAddress}</dd></div><div><dt>${block.free ? "Capacity" : "Reserved"}</dt><dd>${block.size} MB</dd></div>${block.free ? "" : `<div><dt>Useful memory</dt><dd>${block.payload} MB</dd></div><div><dt>Internal waste</dt><dd>${block.waste} MB</dd></div>`}</dl>
            <p class="block-inspector-copy">${
              block.free
                ? fit
                  ? request <= block.size
                    ? `The ${request} MB preview request fits here with ${block.size - request} MB ${simulation.mode === "fixed" ? "internal waste" : "left over"}. This does not force the algorithm to choose this block.`
                    : `This block is ${request - block.size} MB too small for the ${request} MB preview request.`
                  : "Select a waiting process or enter a valid preview size to check this block."
                : `Can grow in place by up to ${block.growthCapacity} MB ${simulation.mode === "fixed" ? "within its reserved partition" : "using the contiguous free space directly after it"}.`
            }</p>
            ${block.free ? "" : `<div class="block-inspector-footer"><span>Created at step ${block.process.creationStep} · allocated at step ${block.process.allocationStep}</span><div><button id="growInspectedProcess" class="button button-secondary button-small" type="button">Request more</button><button id="releaseInspectedProcess" class="button button-danger button-small" type="button">Release memory</button></div></div>`}`;
    document
      .getElementById("closeBlockInspector")
      .addEventListener("click", clearMemoryInspector);
    if (!block.free) {
      document
        .getElementById("growInspectedProcess")
        .addEventListener("click", () => requestMoreFromTable(block.processId));
      document
        .getElementById("releaseInspectedProcess")
        .addEventListener("click", () => terminateFromTable(block.processId));
    }
  }
  if (typeof window !== "undefined") {
    document
      .querySelectorAll(
        "#studioCapacity [data-block-id], #memoryMap [data-block-id]",
      )
      .forEach((element) => {
        const active = Number(element.dataset.blockId) === inspectedBlockId;
        element.classList.toggle("is-selected", active);
        element.setAttribute("aria-pressed", String(active));
      });
  }
}

function setupMemoryInspector() {
  for (const id of ["studioCapacity", "memoryMap"]) {
    const container = document.getElementById(id);
    container.addEventListener("click", (event) => {
      const segment = event.target.closest("[data-block-id]");
      if (segment && container.contains(segment))
        inspectMemoryBlock(Number(segment.dataset.blockId));
    });
    container.addEventListener("keydown", (event) => {
      const segment = event.target.closest("[data-block-id]");
      if (!segment || !container.contains(segment)) return;
      if (["Enter", " "].includes(event.key)) {
        event.preventDefault();
        inspectMemoryBlock(Number(segment.dataset.blockId));
      }
      if (event.key === "Escape") {
        clearMemoryInspector();
        segment.focus();
      }
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        const segments = [...container.querySelectorAll("[data-block-id]")];
        const index = segments.indexOf(segment);
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? segments.length - 1
              : Math.max(
                  0,
                  Math.min(
                    segments.length - 1,
                    index + (event.key === "ArrowRight" ? 1 : -1),
                  ),
                );
        segments[next].focus();
        inspectMemoryBlock(Number(segments[next].dataset.blockId));
      }
    });
  }
}

function compactionMovements(compaction) {
  if (!compaction?.beforeLayout || !compaction?.afterLayout) return [];
  return compaction.afterLayout
    .filter((block) => !block.free)
    .map((block) => {
      const before = compaction.beforeLayout.find(
        (previous) => previous.processId === block.processId,
      );
      return {
        processId: block.processId,
        size: block.size,
        beforeStart: before.startAddress,
        beforeEnd: before.endAddress,
        afterStart: block.startAddress,
        afterEnd: block.endAddress,
        movedBy: before.startAddress - block.startAddress,
      };
    });
}
function compactionSnapshotHtml(compaction) {
  if (!compaction?.beforeLayout || !compaction?.afterLayout) return "";
  const render = (layout, label) =>
    `<div class="compaction-snapshot"><span>${label}</span><div class="compaction-address-map" role="img" aria-label="${escapeHtml(label + ": " + layout.map((block) => (block.free ? "Free" : block.processId) + " " + block.size + " MB, addresses " + block.startAddress + " to " + block.endAddress).join("; "))}">${layout.map((block) => `<span class="${block.free ? "free-snapshot" : "allocated-snapshot"}" style="flex:${block.size};background:${block.free ? "var(--free-line)" : getProcessColorVar(block.processId)}" title="${escapeHtml(block.free ? "Free" : block.processId)} · ${block.size} MB · ${block.startAddress}–${block.endAddress}">${escapeHtml(block.free ? "Free" : block.processId)}</span>`).join("")}</div></div>`;
  const movements = compactionMovements(compaction);
  return `<div class="compaction-snapshots">${render(compaction.beforeLayout, "Before compaction")}${render(compaction.afterLayout, "After compaction")}</div>${movements.length ? `<div class="table-wrapper"><table class="movement-table"><thead><tr><th>Process</th><th>Before address</th><th>After address</th><th>Movement</th></tr></thead><tbody>${movements.map((move) => `<tr><td>${escapeHtml(move.processId)}</td><td>${move.beforeStart}–${move.beforeEnd}</td><td>${move.afterStart}–${move.afterEnd}</td><td>${move.movedBy ? move.movedBy + " MB toward 0" : "Stayed in place"}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
}
function compactionReportHtml(compaction) {
  if (!compaction) return "";
  return `<h2>Last compaction · step ${compaction.step}</h2><p>Free memory was conserved: ${compaction.before.freeMemory} MB before and ${compaction.after.freeMemory} MB after. Largest hole: ${compaction.before.largestFreeBlock} → ${compaction.after.largestFreeBlock} MB.</p><table><tr><th>Process</th><th>Before addresses</th><th>After addresses</th><th>Moved toward 0 (MB)</th></tr>${compactionMovements(
    compaction,
  )
    .map(
      (move) =>
        `<tr><td>${escapeHtml(move.processId)}</td><td>${move.beforeStart}–${move.beforeEnd}</td><td>${move.afterStart}–${move.afterEnd}</td><td>${move.movedBy}</td></tr>`,
    )
    .join("")}</table>`;
}
