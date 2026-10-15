// Local SVG charts keep the academic demo fully offline with no chart dependency.
function updateCharts() {
  const data = simulation.analytics;
  renderTrendChart(
    "utilizationChart",
    data,
    [{ key: "utilization", label: "Utilization", color: "var(--accent)" }],
    100,
    "%",
  );
  renderTrendChart(
    "memoryChart",
    data,
    [
      { key: "allocatedMemory", label: "Allocated", color: "var(--accent)" },
      { key: "freeMemory", label: "Free", color: "var(--text-muted)" },
    ],
    simulation.totalMemory || 1,
    "MB",
  );
  renderTrendChart(
    "fragmentationChart",
    data,
    [
      {
        key: "externalFragmentation",
        label: "External fragmentation",
        color: "var(--warning)",
      },
    ],
    Math.max(simulation.totalMemory, 1),
    "MB",
  );
}

function renderTrendChart(id, data, series, maximum, unit) {
  const container = document.getElementById(id);
  if (!data.length) {
    container.innerHTML =
      '<div class="empty-state small"><span>Configure memory to start recording simulation steps.</span></div>';
    return;
  }
  const width = 540,
    height = 230,
    left = 62,
    right = 22,
    top = 18,
    bottom = 38;
  const plotWidth = width - left - right,
    plotHeight = height - top - bottom;
  const lastStep = Math.max(data[data.length - 1].step, 1);
  const x = (step) => left + (step / lastStep) * plotWidth;
  const y = (value) => top + (1 - value / maximum) * plotHeight;
  const grid = [0, 0.25, 0.5, 0.75, 1]
    .map((ratio) => {
      const value = maximum * ratio,
        pos = y(value);
      return `<line x1="${left}" y1="${pos}" x2="${width - right}" y2="${pos}" stroke="var(--line)"/><text x="${left - 7}" y="${pos + 4}" text-anchor="end">${Number(value.toFixed(1))}</text>`;
    })
    .join("");
  const lines = series
    .map((line) => {
      const points = data
        .map((p) => `${x(p.step)},${y(p[line.key])}`)
        .join(" ");
      const last = data[data.length - 1];
      return `<polyline points="${points}" fill="none" stroke="${line.color}" stroke-width="2.5"/>
            <circle cx="${x(last.step)}" cy="${y(last[line.key])}" r="3" fill="${line.color}"><title>Step ${last.step}: ${Number(last[line.key].toFixed(2))} ${unit}</title></circle>`;
    })
    .join("");
  const title = series.map((s) => s.label).join(" and ");
  container.innerHTML = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title} over simulation steps" preserveAspectRatio="xMidYMid meet">
        <title>${title} over simulation steps (${unit})</title>${grid}${lines}
        <text x="${left}" y="${height - 17}">0</text><text x="${width - right}" y="${height - 17}" text-anchor="end">${lastStep}</text>
        <text x="${width / 2}" y="${height - 5}" text-anchor="middle">Simulation step</text><text x="8" y="12">${unit}</text></svg>
        <div class="chart-legend">${series.map((s) => `<span style="color:${s.color}">● ${s.label}: ${Number(data[data.length - 1][s.key].toFixed(2))} ${unit}</span>`).join("")}</div>`;
}

function renderAnalysisPanels() {
  const stats = calculateStatistics();
  setText("externalRatio", `${stats.externalFragmentationPercent.toFixed(1)}%`);
  setText("internalRatio", `${stats.internalFragmentationPercent.toFixed(1)}%`);
  setText("wastedMemory", `${stats.totalWastedMemory} MB`);
  setText("compactionCount", simulation.compactionCount);
  const severity =
    stats.externalFragmentationPercent >= 60
      ? "High"
      : stats.externalFragmentationPercent >= 30
        ? "Moderate"
        : "Low";
  const badge = document.getElementById("fragmentationSeverity");
  badge.textContent =
    simulation.mode === "fixed" ? "Fixed boundaries" : `${severity} dispersion`;
  badge.className = `status-badge ${simulation.mode === "fixed" || severity === "Low" ? "status-allocated" : severity === "High" ? "status-failed" : "status-waiting"}`;
  setText(
    "fragmentationExplanation",
    simulation.mode === "variable"
      ? "External = free memory − largest free hole. Ratio uses free memory as denominator. Internal = 0 in variable mode. Wasted = internal + external; fragmented free memory can still serve smaller requests."
      : "Internal = reserved − requested memory. Internal ratio uses reserved memory as denominator. External fragmentation is not applicable (0): fixed free partitions cannot merge, even when adjacent.",
  );
  const diagnostic = simulation.lastFailure;
  const failure = document.getElementById("failureAnalysis");
  if (!diagnostic)
    failure.innerHTML =
      '<p class="panel-meta">No unresolved allocation failure. A failed request will show its cause and recovery options here.</p>';
  else
    failure.innerHTML = `<div class="diagnostic-title">Allocation failed · ${escapeHtml(diagnostic.processId)} · Step ${diagnostic.step}</div>
        <dl class="metric-list"><div><dt>Requested${diagnostic.growth ? " / additional" : ""}</dt><dd>${diagnostic.requestedMemory} MB</dd></div>
        <div><dt>Total free</dt><dd>${diagnostic.freeMemory} MB</dd></div><div><dt>Largest free block</dt><dd>${diagnostic.largestFreeBlock} MB</dd></div>
        <div><dt>Free blocks</dt><dd>${diagnostic.freeBlockCount}</dd></div><div><dt>External fragmentation</dt><dd>${diagnostic.externalFragmentation} MB</dd></div></dl>
        <p><strong>Reason:</strong> ${escapeHtml(diagnostic.reason)}</p><p><strong>Recommendation:</strong> ${escapeHtml(diagnostic.recommendation)}</p>
        <p class="panel-meta">Metrics captured at the failed attempt. Retry after changing the layout.</p>`;
  const compaction = simulation.lastCompaction;
  const panel = document.getElementById("compactionAnalysis");
  if (!compaction)
    panel.innerHTML = `<p class="panel-meta">${simulation.mode === "fixed" ? "Fixed partitions retain their boundaries. Switch to variable mode to demonstrate compaction." : "Compact memory to move allocated processes toward address 0 and combine all free space. Total free memory remains unchanged."}</p>`;
  else
    panel.innerHTML = `<p><strong>Step ${compaction.step} · ${compaction.moved} processes moved</strong></p>
        ${compactionSnapshotHtml(compaction)}
        <table><thead><tr><th>Metric</th><th>Before</th><th>After</th></tr></thead><tbody>
        ${[
          ["Free memory", "freeMemory"],
          ["Largest free block", "largestFreeBlock"],
          ["External fragmentation", "externalFragmentation"],
        ]
          .map(
            ([label, key]) =>
              `<tr><td>${label}</td><td>${compaction.before[key]} MB</td><td>${compaction.after[key]} MB</td></tr>`,
          )
          .join("")}</tbody></table>
        <p class="panel-meta">Snapshots capture the compaction itself; later actions appear in the live memory map. Free memory and process requests are preserved.</p>`;
}
