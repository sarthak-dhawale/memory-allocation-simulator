// Teaching views are read-only: all values come from the live state or comparison snapshots.
function nextFitPointerHtml(state, show = state.algorithm === "next-fit") {
  if (!show || !state.totalMemory) return "";
  const address = state.nextFitAddress || 0;
  const position = (address / state.totalMemory) * 100;
  const region = state.memory.find(
    (block) => block.startAddress <= address && block.endAddress >= address,
  );
  const context = region
    ? `Search starts in block ${region.id} (${region.free ? "free" : "allocated; skipped"}), then wraps if needed.`
    : "Search wraps to the beginning if needed.";
  return `<div class="next-fit-pointer" style="--pointer-position:${position}%" role="note" aria-label="Next Fit resumes at ${address} MB. ${escapeHtml(context)}"><i aria-hidden="true"></i><span>↻ Next Fit · ${address} MB</span></div>`;
}

function explainMemoryMetrics(state) {
  const stats = MemoryEngine.statistics(state);
  const useful = stats.allocatedMemory - stats.internalFragmentation;
  const percent = (value) => Number(value.toFixed(1));
  if (!stats.totalMemory)
    return {
      useful: "Configure memory to calculate useful utilization.",
      internal:
        "Internal waste is unused space inside a reserved process allocation.",
      external:
        "External fragmentation is free space spread across separate holes.",
    };
  return {
    useful: `${useful} MB actually requested ÷ ${stats.totalMemory} MB total = ${percent(stats.payloadUtilization)}% useful utilization. Reserved utilization is ${percent(stats.utilization)}%, including any internal waste.`,
    internal: `${stats.allocatedMemory} MB reserved − ${useful} MB requested = ${stats.internalFragmentation} MB internal waste. ${state.mode === "fixed" ? "A fixed partition reserves its full capacity." : "Variable allocations match the request, so internal waste is zero."}`,
    external:
      state.mode === "fixed"
        ? "External fragmentation is shown as 0 in fixed mode. A request can still fail if no free partition is large enough; fixed boundaries cannot merge."
        : `${stats.freeMemory} MB free − ${stats.largestFreeBlock} MB largest hole = ${stats.externalFragmentation} MB external fragmentation. ${stats.externalFragmentation ? "This space can still serve smaller requests; compaction combines the holes." : "All free memory is contiguous, or no free memory remains."}`,
  };
}

function memoryMetricsHtml(state) {
  const explanations = explainMemoryMetrics(state);
  return [
    ["Useful utilization", "useful"],
    ["Internal waste", "internal"],
    ["External fragmentation", "external"],
  ]
    .map(
      ([title, key]) =>
        `<article><h3>${title}</h3><p>${escapeHtml(explanations[key])}</p></article>`,
    )
    .join("");
}

function renderLearningViews() {
  for (const id of ["overviewPointer", "studioPointer"])
    document.getElementById(id).innerHTML = nextFitPointerHtml(simulation);
  const explanations = memoryMetricsHtml(simulation);
  for (const id of [
    "overviewMetricHelp",
    "studioMetricHelp",
    "analyticsMetricHelp",
  ])
    document.getElementById(id).innerHTML = explanations;
  renderComparisonLayouts(simulation.comparisonResults);
}

function comparisonLayoutsHtml(results) {
  return results
    .map((result) => {
      const blocks = result.finalMemory;
      const rows = blocks
        .map(
          (block) =>
            `<tr><td>${escapeHtml(block.free ? "Free" : block.processId)}</td><td>${block.startAddress}–${block.endAddress}</td><td>${block.size} MB</td></tr>`,
        )
        .join("");
      const description = blocks
        .map(
          (block) =>
            `${block.free ? "Free" : block.processId}: ${block.size} MB, addresses ${block.startAddress} to ${block.endAddress}`,
        )
        .join("; ");
      const segments = blocks
        .map((block) => {
          const process = result.finalProcesses.find(
            (process) => process.id === block.processId,
          );
          const waste = block.free
            ? 0
            : Math.max(0, block.size - process.requestedMemory);
          return `<span class="comparison-segment ${block.free ? "is-free" : ""}" style="flex:${block.size};background:${block.free ? "var(--free)" : getProcessColorVar(block.processId)}" title="${escapeHtml(block.free ? "Free" : block.processId)} · ${block.size} MB · ${block.startAddress}–${block.endAddress}${waste ? ` · ${waste} MB internal waste` : ""}"><span>${escapeHtml(block.free ? "Free" : block.processId)}</span>${waste ? `<i class="comparison-waste" style="width:${(waste / block.size) * 100}%" aria-hidden="true"></i>` : ""}</span>`;
        })
        .join("");
      const pointerState = { ...result, memory: blocks, algorithm: result.key };
      const payload = result.allocatedMemory - result.internalFragmentation;
      return `<article class="comparison-layout-card"><div class="comparison-layout-title"><h3>${escapeHtml(result.name)}</h3><span>${result.successfulAllocations} succeeded · ${result.failedAllocations} failed</span></div><div class="comparison-memory-bar" role="img" aria-label="${escapeHtml(result.name + " final layout. " + description)}">${segments}</div>${nextFitPointerHtml(pointerState)}<div class="comparison-addresses"><span>0 MB</span><span>${result.totalMemory} MB</span></div><dl class="comparison-layout-stats"><div><dt>Useful</dt><dd>${payload} MB</dd></div><div><dt>Free</dt><dd>${result.freeMemory} MB</dd></div><div><dt>Largest hole</dt><dd>${result.largestFreeBlock} MB</dd></div><div><dt>Internal waste</dt><dd>${result.internalFragmentation} MB</dd></div></dl><details><summary>Inspect ${escapeHtml(result.name)} addresses</summary><div class="table-wrapper"><table><thead><tr><th>Owner</th><th>Address range</th><th>Reserved size</th></tr></thead><tbody>${rows}</tbody></table></div></details></article>`;
    })
    .join("");
}

function renderComparisonLayouts(results) {
  const container = document.getElementById("comparisonLayouts");
  const section = document.getElementById("comparisonLayoutSection");
  section.hidden = !results.length;
  container.innerHTML = comparisonLayoutsHtml(results);
  const stale = simulation.comparisonStep !== simulation.step;
  setText(
    "comparisonLayoutNote",
    results.length
      ? `Snapshot from step ${simulation.comparisonStep} · ${simulation.mode === "fixed" ? "fixed" : "variable"} partitions. Same starting memory and workload; widths use the same scale.${stale ? " Live memory has changed: rerun comparison to refresh these maps." : ""}`
      : "",
  );
}
