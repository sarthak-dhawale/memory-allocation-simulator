// Workspace navigation and presentation read the same simulation state as the studio.
const WORKSPACE_PAGES = {
  overview: [
    "Memory overview",
    "Live memory state, allocation results, and available capacity.",
    "Overview",
  ],
  simulator: [
    "Simulation studio",
    "Configure, allocate, and inspect your memory.",
    "Simulation studio",
  ],
  processes: [
    "Every process has a story.",
    "Follow requests, allocations, and releases in one place.",
    "Processes",
  ],
  comparison: [
    "Find the right fit.",
    "Different strategies. The same workload. Real results.",
    "Compare algorithms",
  ],
  analytics: [
    "A clearer picture of memory.",
    "Follow the space you use, the space you have, and the gaps between.",
    "Memory insights",
  ],
  activity: [
    "Your simulation, step by step.",
    "A record of every meaningful memory decision.",
    "Activity log",
  ],
  guide: [
    "Get to know your memory.",
    "A few simple ideas behind every allocation.",
    "How it works",
  ],
};

function navigateTo(page) {
  if (!WORKSPACE_PAGES[page]) page = "overview";
  if (page !== "simulator") pauseWalkthrough();
  document.querySelectorAll("[data-page]").forEach((element) => {
    element.hidden = element.dataset.page !== page;
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    const active = link.dataset.navigate === page;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  const [title, subtitle, breadcrumb] = WORKSPACE_PAGES[page];
  setText("pageTitle", title);
  setText("pageSubtitle", subtitle);
  setText("breadcrumbLabel", breadcrumb);
  document.documentElement.dataset.workspace = page;
  closeNavigation();
  if (window.location.hash !== `#${page}`) window.location.hash = page;
  window.scrollTo({ top: 0, behavior: "instant" });
}

function closeNavigation() {
  document.getElementById("sidebar").classList.remove("is-open");
  document.getElementById("sidebarBackdrop").hidden = true;
  document.getElementById("menuButton").setAttribute("aria-expanded", "false");
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = document.getElementById("themeButton");
  button.setAttribute(
    "aria-label",
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
  );
  button.setAttribute("aria-pressed", String(theme === "dark"));
  button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#icon-${theme === "dark" ? "sun" : "moon"}"></use></svg>`;
  try {
    localStorage.setItem("memlab-theme", theme);
  } catch {
    /* Page remains usable when browser storage is unavailable. */
  }
}

function initializeWorkspace() {
  setupOverviewDemo();
  document.querySelectorAll("[data-navigate]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      navigateTo(link.dataset.navigate);
      document.getElementById("mainContent").focus({ preventScroll: true });
    });
  });
  window.addEventListener("hashchange", () => {
    const page = window.location.hash.slice(1);
    if (WORKSPACE_PAGES[page]) navigateTo(page);
  });
  document.getElementById("menuButton").addEventListener("click", () => {
    const open = !document
      .getElementById("sidebar")
      .classList.contains("is-open");
    document.getElementById("sidebar").classList.toggle("is-open", open);
    document.getElementById("sidebarBackdrop").hidden = !open;
    document
      .getElementById("menuButton")
      .setAttribute("aria-expanded", String(open));
    if (open) document.querySelector(".sidebar .nav-link")?.focus();
  });
  document.getElementById("sidebarBackdrop").addEventListener("click", () => {
    closeNavigation();
    document.getElementById("menuButton").focus();
  });
  document.addEventListener("keydown", (event) => {
    if (
      event.key === "Escape" &&
      document.getElementById("sidebar").classList.contains("is-open")
    ) {
      closeNavigation();
      document.getElementById("menuButton").focus();
    }
  });
  document
    .getElementById("themeButton")
    .addEventListener("click", () =>
      applyTheme(
        document.documentElement.dataset.theme === "dark" ? "light" : "dark",
      ),
    );
  let theme = "light";
  try {
    if (localStorage.getItem("memlab-theme") === "dark") theme = "dark";
  } catch {
    /* Default to the reference's light theme. */
  }
  applyTheme(theme);
  navigateTo(window.location.hash.slice(1));
}

function renderWorkspaceSummary() {
  const stats = calculateStatistics();
  setText(
    "overviewMode",
    simulation.mode === "fixed" ? "Fixed partitions" : "Variable partitions",
  );
  setText(
    "overviewMemoryStatus",
    stats.totalMemory
      ? stats.allocatedProcesses
        ? `${stats.allocatedProcesses} ${stats.allocatedProcesses === 1 ? "process" : "processes"} in memory`
        : "Ready for your workload"
      : "Configure memory to begin",
  );
  setText("overviewAlgorithm", formatAlgorithmName(simulation.algorithm));
  setText("overviewAllocated", `${stats.allocatedMemory} MB`);
  setText("overviewFree", `${stats.freeMemory} MB`);
  setText("overviewProcessCount", stats.allocatedProcesses);
  setText("overviewLargest", `${stats.largestFreeBlock} MB`);
  setText("overviewExternal", `${stats.externalFragmentation} MB`);
  setText(
    "overviewNextHint",
    !stats.totalMemory
      ? "Load a scenario or configure memory to begin."
      : simulation.lastFailure
        ? "Your latest request needs attention. Check its diagnostic in the studio."
        : stats.waitingProcesses
          ? `${stats.waitingProcesses} waiting process${stats.waitingProcesses === 1 ? " is" : "es are"} ready for an allocation attempt.`
          : "Create a process or try a scenario to explore your memory.",
  );
  setText(
    "workspaceStatus",
    stats.totalMemory ? "Simulation ready" : "Ready to begin",
  );
  setText(
    "workspaceStatusDescription",
    `${simulation.mode === "fixed" ? "Fixed" : "Variable"} partitioning · ${formatAlgorithmName(simulation.algorithm)} · ${stats.totalMemory} MB configured`,
  );
  setText("workspaceStep", `Step ${simulation.step}`);
  setText("studioAllocated", `${stats.allocatedMemory} MB`);
  setText("studioFree", `${stats.freeMemory} MB`);
  setText("studioLargest", `${stats.largestFreeBlock} MB`);
  setText("studioUtilization", `${Number(stats.utilization.toFixed(1))}%`);
  setText("studioStep", `Step ${simulation.step}`);
  setText("studioEndAddress", `${stats.totalMemory} MB`);
  setText("overviewAddressEnd", `0 – ${Math.max(0, stats.totalMemory - 1)} MB`);
  const regions = document.getElementById("overviewRegions");
  if (regions)
    regions.innerHTML =
      simulation.memory
        .slice(0, 6)
        .map(
          (block) =>
            `<div class="overview-region"><span class="region-identity"><i style="background:${block.free ? "var(--free-line)" : getProcessColorVar(block.processId)}"></i><strong>${escapeHtml(block.free ? "Free space" : block.processId)}</strong><span>${escapeHtml(block.free ? "Available" : block.processName)}</span></span><span class="region-range">${block.startAddress}–${block.endAddress}</span><strong>${block.size} MB</strong></div>`,
        )
        .join("") +
      (simulation.memory.length > 6
        ? `<a class="overview-more" href="#simulator">View all ${simulation.memory.length} regions in studio →</a>`
        : "");
  const capacity = document.getElementById("overviewCapacity");
  capacity.innerHTML = simulation.memory
    .map((block) => {
      const process = simulation.processes.find(
        (p) => p.id === block.processId,
      );
      const waste =
        !block.free && simulation.mode === "fixed"
          ? block.size - process.requestedMemory
          : 0;
      return `<span aria-label="${escapeHtml(block.free ? "Free block " + block.id : block.processId + " · " + block.processName)} · ${block.size} MB · addresses ${block.startAddress} to ${block.endAddress}" class="address-segment ${block.free ? "free-segment" : "allocated-segment"}" data-block-id="${block.id}" data-motion-key="${escapeHtml(block.free ? "free-" + block.id : "process-" + block.processId)}" style="flex:${block.size};background:${block.free ? "var(--free-line)" : getProcessColorVar(block.processId)}" title="${escapeHtml(block.free ? "Free" : block.processId)} · ${block.size} MB${waste ? ` · ${waste} MB internal waste` : ""}"><span class="segment-label">${escapeHtml(block.free ? "Free" : block.processId)}<small>${block.size} MB</small></span>${waste ? `<span class="internal-waste-overlay" style="width:${(waste / block.size) * 100}%" aria-hidden="true"></span>` : ""}</span>`;
    })
    .join("");
  setText(
    "studioPayload",
    `${Number(stats.payloadUtilization.toFixed(1))}% useful utilization`,
  );
  setText("studioWaste", `${stats.internalFragmentation} MB internal waste`);
  document.getElementById("studioCapacity").innerHTML =
    capacity.innerHTML.replaceAll(
      "<span aria-label=",
      '<span role="button" tabindex="0" aria-pressed="false" aria-controls="memoryInspector" aria-label=',
    );
  renderLearningViews();
}
