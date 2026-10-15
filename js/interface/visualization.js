// Visualization layer only — reads simulation state, never decides allocation.

// Assigns each process a stable accent color by hashing its ID (cosmetic only).

const PROCESS_COLORS = ["--p1", "--p2", "--p3", "--p4", "--p5", "--p6"];

function getProcessColorVar(processId) {
  if (!processId) {
    return "var(--copper)";
  }

  let hash = 0;
  for (let i = 0; i < processId.length; i++) {
    hash = (hash * 31 + processId.charCodeAt(i)) >>> 0;
  }

  const variable = PROCESS_COLORS[hash % PROCESS_COLORS.length];
  return `var(${variable})`;
}

// MEMORY MAP

// Renders the current memory state.
function renderMemoryMap() {
  const container = document.getElementById("memoryMap");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!simulation.memory || simulation.memory.length === 0) {
    container.innerHTML = `
            <div class="empty-state">
                <strong>No memory configured</strong>
                <span>
                    Load sample data or configure custom blocks to begin.
                </span>
            </div>
        `;

    setText("memoryMapTotal", "0 MB");
    updateMemoryMapLegend();

    return;
  }

  // Calculate total memory represented by the map.
  const totalMemory = simulation.memory.reduce(
    (total, block) => total + block.size,
    0,
  );

  for (const block of simulation.memory) {
    const element = document.createElement("div");

    element.className = `memory-block ${block.free ? "free" : "allocated"}`;
    element.dataset.blockId = block.id;
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-controls", "memoryInspector");
    element.setAttribute(
      "aria-label",
      `Block ${block.id} · ${block.free ? "Free" : block.processId} · ${block.size} MB · addresses ${block.startAddress} to ${block.endAddress}`,
    );
    element.title = `Block ${block.id} · ${block.free ? "FREE" : block.processId + " — " + block.processName} · ${block.size} MB · addresses ${block.startAddress}–${block.endAddress}`;

    // The height represents the proportion of memory occupied by this partition.
    const percentage = totalMemory > 0 ? (block.size / totalMemory) * 100 : 0;

    // Keep very small blocks visible.
    const height = Math.max(42, percentage * 2.0);

    element.style.minHeight = `${height}px`;

    if (block.free) {
      element.innerHTML = `
                <div class="memory-block-gutter">
                    ${block.startAddress}
                </div>

                <div class="memory-block-body">
                    <div class="memory-block-content">
                        <span class="memory-block-title">
                            Free space
                        </span>

                        <span class="memory-block-size">
                            ${block.size} MB
                        </span>
                    </div>
                </div>

                <div class="memory-block-tail">
                    ${block.endAddress}
                </div>
            `;
    } else {
      element.style.setProperty(
        "--proc-color",
        getProcessColorVar(block.processId),
      );

      element.innerHTML = `
                <div class="memory-block-gutter">
                    ${block.startAddress}
                </div>

                <div class="memory-block-body">
                    <div class="memory-block-content">
                        <span class="memory-block-title">
                            <span class="memory-block-pid">${escapeHtml(block.processId)}</span>
                            —
                            ${escapeHtml(block.processName)}
                        </span>

                        <span class="memory-block-size">
                            ${block.size} MB reserved${simulation.mode === "fixed" ? ` · ${simulation.processes.find((p) => p.id === block.processId)?.requestedMemory || 0} MB requested` : ""}
                        </span>
                    </div>
                </div>

                <div class="memory-block-tail">
                    ${block.endAddress}
                </div>
            `;
    }

    container.appendChild(element);
  }

  // Update total memory shown in memory-map header.
  const totalLabel = document.getElementById("memoryMapTotal");

  if (totalLabel) {
    totalLabel.textContent = `${totalMemory} MB`;
  }

  updateMemoryMapLegend();
}

// Renders the color legend beneath the memory map (hidden when nothing is allocated).
function updateMemoryMapLegend() {
  const legend = document.getElementById("memoryMapLegend");

  if (!legend) {
    return;
  }

  const allocatedBlocks = (simulation.memory || []).filter(
    (block) => !block.free,
  );

  if (allocatedBlocks.length === 0) {
    legend.innerHTML = "";
    legend.style.display = "none";
    return;
  }

  legend.style.display = "flex";

  legend.innerHTML =
    allocatedBlocks
      .map(
        (block) => `
            <span class="legend-swatch">
                <span
                    class="legend-chip"
                    style="background:${getProcessColorVar(block.processId)}"
                ></span>
                ${escapeHtml(block.processId)}
            </span>
        `,
      )
      .join("") +
    `<span class="legend-swatch">
            <span class="legend-chip" style="background:var(--free)"></span>
            Free
        </span>`;
}

// PROCESS TABLE

// Renders the simulated process table.
function renderProcessTable() {
  const tableBody = document.getElementById("processTableBody");

  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = "";

  if (!simulation.processes || simulation.processes.length === 0) {
    tableBody.innerHTML = `
            <tr>
                <td
                    colspan="10"
                    class="table-empty"
                >
                    No processes created yet.
                </td>
            </tr>
        `;

    updateProcessSummary();

    return;
  }

  for (const process of simulation.processes) {
    const row = document.createElement("tr");

    const statusClass =
      process.status === "allocated"
        ? "status-allocated"
        : process.status === "waiting"
          ? "status-waiting"
          : "status-terminated";

    const statusText =
      process.status === "waiting" && process.allocationFailures > 0
        ? "Failed / Waiting"
        : process.status.charAt(0).toUpperCase() + process.status.slice(1);

    let actions = "";

    if (process.status === "waiting") {
      actions = `
                <button
                    class="button button-primary button-small"
                    data-action="allocate"
                >
                    Allocate
                </button>
            `;
    } else if (process.status === "allocated") {
      actions = `
                <button
                    class="button button-secondary button-small"
                    data-action="grow"
                >
                    Request More
                </button>

                <button
                    class="button button-danger button-small"
                    data-action="terminate"
                >
                    Terminate
                </button>
            `;
    } else {
      actions = `
                <span class="panel-meta">
                    Released
                </span>
            `;
    }

    const dotColor =
      process.status === "terminated"
        ? "var(--text-muted)"
        : getProcessColorVar(process.id);

    row.innerHTML = `

            <td>
                <span class="process-id-cell">
                    <span
                        class="process-color-dot"
                        style="--proc-color:${dotColor}"
                    ></span>
                    ${escapeHtml(process.id)}
                </span>
            </td>

            <td>
                ${escapeHtml(process.name)}
            </td>

            <td class="mono">
                ${process.requestedMemory} MB
            </td>

            <td class="mono">
                ${process.allocatedMemory} MB
            </td>

            <td>
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
            </td>

            <td class="mono">${process.status === "allocated" ? process.allocatedMemory - process.requestedMemory : 0} MB</td>
            <td class="mono">${process.allocationAttempts}</td>
            <td class="mono">${process.allocationFailures}</td>
            <td class="lifecycle-cell">Block ${process.blockId ?? "—"}<br>Created ${process.creationStep} · Allocated ${process.allocationStep ?? "—"} · End ${process.terminationStep ?? "—"}</td>
            <td>
                <div class="action-buttons">
                    ${actions}
                </div>
            </td>
        `;

    row
      .querySelector('[data-action="allocate"]')
      ?.addEventListener("click", () => allocateFromTable(process.id));
    row
      .querySelector('[data-action="grow"]')
      ?.addEventListener("click", () => requestMoreFromTable(process.id));
    row
      .querySelector('[data-action="terminate"]')
      ?.addEventListener("click", () => terminateFromTable(process.id));
    tableBody.appendChild(row);
  }

  updateProcessSummary();
}

// PROCESS SELECT

// Updates the process dropdown used by the Allocate button.
function renderProcessSelect() {
  const select = document.getElementById("allocationProcessSelect");

  if (!select) {
    return;
  }

  const selectedId = select.value;
  select.innerHTML = `
        <option value="">
            Select process
        </option>
    `;

  for (const process of simulation.processes) {
    if (process.status !== "waiting") {
      continue;
    }

    const option = document.createElement("option");

    option.value = process.id;

    option.textContent = `${process.id} — ${process.name} (${process.requestedMemory} MB)`;

    select.appendChild(option);
  }
  select.value = simulation.processes.some(
    (process) => process.id === selectedId && process.status === "waiting",
  )
    ? selectedId
    : "";
}

// DASHBOARD

// Updates dashboard statistics.
function renderStatistics() {
  const stats = calculateStatistics();

  setText("totalMemory", `${stats.totalMemory} MB`);

  setText("allocatedMemory", `${stats.allocatedMemory} MB`);

  setText("freeMemory", `${stats.freeMemory} MB`);

  setText("utilization", `${stats.utilization.toFixed(1)}%`);

  setText("processCount", stats.totalProcesses);

  setText("freeBlockCount", stats.freeBlockCount);

  setText("internalFragmentation", `${stats.internalFragmentation} MB`);

  setText("externalFragmentation", `${stats.externalFragmentation} MB`);

  setText("largestFreeBlock", `${stats.largestFreeBlock} MB`);
}

// ACTIVITY LOG

// Displays recent simulation events.
function renderActivityLog() {
  const container = document.getElementById("activityLog");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!simulation.events || simulation.events.length === 0) {
    container.innerHTML = `
            <div class="empty-state small">
                <span>
                    No simulation events yet.
                </span>
            </div>
        `;

    return;
  }

  for (const event of simulation.events) {
    const element = document.createElement("div");

    element.className = "log-entry";

    element.innerHTML = `
            <span class="log-time">
                ${escapeHtml(event.time)}
            </span>

            <span class="log-message">
                ${escapeHtml(event.message)}
            </span>
        `;

    container.appendChild(element);
  }
}

// ALLOCATION STEPS

// Displays the reasoning returned by the allocation algorithm.
function renderAllocationSteps(result, requestSize) {
  const container = document.getElementById("allocationSteps");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!result) {
    container.innerHTML = `
            <div class="empty-state small">
                <span>
                    Allocation decisions will appear here.
                </span>
            </div>
        `;

    return;
  }

  let stepNumber = 1;

  // Step 1 — Request
  addStep(
    container,
    stepNumber++,
    `Request = <strong>${requestSize} MB</strong>`,
  );

  // Display blocks checked by the algorithm.
  for (const block of result.checkedBlocks) {
    if (block.suitable) {
      addStep(
        container,
        stepNumber++,
        `Block ${block.blockId} — ${block.size} MB → <strong>Suitable</strong>`,
      );
    } else {
      addStep(
        container,
        stepNumber++,
        `Block ${block.blockId} — ${block.size} MB → Too small`,
      );
    }
  }

  if (result.success) {
    addStep(
      container,
      stepNumber++,
      `Block <strong>${result.selectedBlockId}</strong> selected`,
    );

    if (result.leftover > 0) {
      addStep(
        container,
        stepNumber++,
        simulation.mode === "fixed"
          ? `Internal waste = <strong>${result.leftover} MB</strong> (entire partition reserved)`
          : `Split block; leftover free space = <strong>${result.leftover} MB</strong>`,
      );
    }

    addStep(container, stepNumber++, `<strong>Allocation successful</strong>`);
  } else {
    addStep(
      container,
      stepNumber++,
      `<strong>No suitable free block found</strong>`,
    );
  }
}

// Adds one step to the allocation explanation.
function addStep(container, number, text) {
  const element = document.createElement("div");

  element.className = "step";

  element.innerHTML = `
        <span class="step-number">
            ${number}
        </span>

        <span class="step-text">
            ${text}
        </span>
    `;

  container.appendChild(element);
}

// HELPERS

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function updateProcessSummary() {
  const element = document.getElementById("processSummary");

  if (!element) {
    return;
  }

  const count = simulation.processes.length;

  element.textContent = `${count} process${count === 1 ? "" : "es"}`;
}

// Prevent HTML injection when displaying process data.
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
