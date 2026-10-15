// Shared local engine: interactive actions and comparison runs use identical transitions.
const MemoryEngine = {
  algorithms: {
    "first-fit": firstFit,
    "best-fit": bestFit,
    "worst-fit": worstFit,
    "next-fit": nextFit,
  },

  state(mode = "variable") {
    return {
      totalMemory: 0,
      memory: [],
      initialMemory: [],
      processes: [],
      algorithm: "first-fit",
      mode,
      nextFitAddress: 0,
      initialAlgorithm: "first-fit",
      lastDecision: null,
      guide: null,
      events: [],
      step: 0,
      nextBlockId: 1,
      analytics: [],
      workload: [],
      metrics: { attempts: 0, successes: 0, failures: 0, searchOperations: 0 },
      compactionCount: 0,
      lastFailure: null,
      lastCompaction: null,
      comparisonResults: [],
      scenario: null,
      scenarioCursor: 0,
      scenarioPending: false,
      stepMode: false,
      stepSimulation: {
        steps: [],
        currentStep: 0,
        processId: null,
        algorithmResult: null,
        completed: false,
      },
    };
  },

  initialize(state, sizes) {
    if (
      !Array.isArray(sizes) ||
      !sizes.length ||
      sizes.some((s) => !Number.isSafeInteger(s) || s <= 0) ||
      !Number.isSafeInteger(sizes.reduce((sum, s) => sum + s, 0))
    ) {
      throw new Error("Memory must contain positive, safe whole MB values.");
    }
    const mode = state.mode;
    const algorithm = state.algorithm;
    Object.assign(state, this.state(mode), {
      algorithm,
      initialAlgorithm: algorithm,
    });
    state.memory = sizes.map((size) => this.freeBlock(state, size));
    state.initialMemory = state.memory.map((b) => ({ id: b.id, size: b.size }));
    state.totalMemory = sizes.reduce((sum, size) => sum + size, 0);
    this.addresses(state);
    this.event(
      state,
      `Memory initialized: ${state.totalMemory} MB, ${mode} partitioning. ${mode === "fixed" ? "Partition boundaries remain fixed." : "Initial regions remain selectable until merging or compaction."}`,
    );
  },

  freeBlock(state, size) {
    return {
      id: state.nextBlockId++,
      size,
      free: true,
      processId: null,
      processName: null,
    };
  },

  addresses(state) {
    let address = 0;
    for (const block of state.memory) {
      block.startAddress = address;
      block.endAddress = address + block.size - 1;
      address += block.size;
    }
  },

  statistics(state) {
    const freeBlocks = state.memory.filter((b) => b.free);
    const freeMemory = freeBlocks.reduce((sum, b) => sum + b.size, 0);
    const allocatedMemory = state.memory
      .filter((b) => !b.free)
      .reduce((sum, b) => sum + b.size, 0);
    const largestFreeBlock = freeBlocks.reduce(
      (max, b) => Math.max(max, b.size),
      0,
    );
    const internalFragmentation = state.processes
      .filter((p) => p.status === "allocated")
      .reduce((sum, p) => sum + p.allocatedMemory - p.requestedMemory, 0);
    // Fixed boundaries cannot be removed; their free-partition dispersion is not external fragmentation.
    const externalFragmentation =
      state.mode === "variable" ? freeMemory - largestFreeBlock : 0;
    return {
      totalMemory: state.totalMemory,
      allocatedMemory,
      freeMemory,
      largestFreeBlock,
      freeBlockCount: freeBlocks.length,
      internalFragmentation,
      externalFragmentation,
      externalFragmentationPercent: freeMemory
        ? (externalFragmentation / freeMemory) * 100
        : 0,
      internalFragmentationPercent: allocatedMemory
        ? (internalFragmentation / allocatedMemory) * 100
        : 0,
      totalWastedMemory: internalFragmentation + externalFragmentation,
      utilization: state.totalMemory
        ? (allocatedMemory / state.totalMemory) * 100
        : 0,
      payloadUtilization: state.totalMemory
        ? ((allocatedMemory - internalFragmentation) / state.totalMemory) * 100
        : 0,
      totalProcesses: state.processes.length,
      allocatedProcesses: state.processes.filter(
        (p) => p.status === "allocated",
      ).length,
      waitingProcesses: state.processes.filter((p) => p.status === "waiting")
        .length,
      terminatedProcesses: state.processes.filter(
        (p) => p.status === "terminated",
      ).length,
    };
  },

  event(state, message) {
    state.step++;
    state.events.unshift({
      step: state.step,
      time: `Step ${state.step}`,
      message,
    });
    state.analytics.push({ step: state.step, ...this.statistics(state) });
  },

  create(state, id, name, size, record = true) {
    if (
      typeof id !== "string" ||
      !id.trim() ||
      typeof name !== "string" ||
      !name.trim()
    )
      return { success: false, message: "Process ID and name are required." };
    if (!Number.isSafeInteger(size) || size <= 0)
      return {
        success: false,
        message: "Memory requirement must be a positive, safe whole MB value.",
      };
    if (
      state.processes.some(
        (p) => p.id.toLowerCase() === id.trim().toLowerCase(),
      )
    )
      return { success: false, message: `Process ID ${id} already exists.` };
    if (!state.totalMemory)
      return { success: false, message: "Configure memory first." };
    const process = {
      id: id.trim(),
      name: name.trim(),
      requestedMemory: size,
      allocatedMemory: 0,
      status: "waiting",
      blockId: null,
      allocationAttempts: 0,
      allocationFailures: 0,
      creationStep: state.step + 1,
      allocationStep: null,
      terminationStep: null,
    };
    state.processes.push(process);
    if (record)
      state.workload.push({
        type: "create",
        id: process.id,
        name: process.name,
        size,
      });
    this.event(
      state,
      `${process.id} (${process.name}) created; waiting for ${size} MB.`,
    );
    return { success: true, process };
  },

  analyzeFailure(state, requestedMemory, growthProcess = null) {
    const stats = this.statistics(state);
    let reason, recommendation, kind;
    if (growthProcess && state.mode === "fixed") {
      kind = "partition-limit";
      reason = "The request exceeds the process's fixed partition capacity.";
      recommendation =
        "Use a larger partition or restart in variable partition mode.";
    } else if (stats.freeMemory < requestedMemory) {
      kind = "insufficient-memory";
      reason = "Total available memory is insufficient.";
      recommendation =
        "Terminate another process or reduce the request; compaction cannot create memory.";
    } else if (state.mode === "fixed") {
      kind = "partition-limit";
      reason =
        "Free partitions exist, but no single fixed partition can hold this request.";
      recommendation =
        "Configure larger fixed partitions; compaction cannot change fixed boundaries.";
    } else if (growthProcess) {
      kind = "adjacency";
      reason =
        "The free space immediately after this process cannot satisfy its growth request.";
      recommendation =
        "Release the adjacent process, or compact and retry if this process is last. Growth never relocates or duplicates a process.";
    } else {
      kind = "external-fragmentation";
      reason =
        "Sufficient total free memory exists, but no contiguous free block is large enough.";
      recommendation =
        "Perform Memory Compaction, then retry this waiting process.";
    }
    return {
      requestedMemory,
      ...stats,
      kind,
      reason,
      recommendation,
      processId: growthProcess?.id || null,
      step: state.step + 1,
      growth: !!growthProcess,
    };
  },

  attempt(state, process, result) {
    process.allocationAttempts++;
    state.metrics.attempts++;
    state.metrics.searchOperations += result.checkedBlocks.length;
  },

  failure(state, process, result, size, growth = false) {
    process.allocationFailures++;
    state.metrics.failures++;
    state.lastFailure = {
      ...this.analyzeFailure(state, size, growth ? process : null),
      processId: process.id,
    };
    this.event(
      state,
      `${process.id} allocation failed (${size} MB): ${state.lastFailure.reason} Free ${state.lastFailure.freeMemory} MB; largest ${state.lastFailure.largestFreeBlock} MB; ${state.lastFailure.freeBlockCount} free blocks; external fragmentation ${state.lastFailure.externalFragmentation} MB. ${state.lastFailure.recommendation}`,
    );
    return {
      success: false,
      message: state.lastFailure.reason,
      diagnostic: state.lastFailure,
      algorithmResult: result,
    };
  },

  // Pure search shared by allocation, previews and the step-by-step explanation.
  search(state, size, algorithm = state.algorithm) {
    return this.algorithms[algorithm](state.memory, size, state.nextFitAddress);
  },

  allocate(state, id, record = true) {
    const process = state.processes.find((p) => p.id === id);
    if (!process || process.status !== "waiting")
      return {
        success: false,
        message: "Only a waiting process can be allocated.",
      };
    if (record) state.workload.push({ type: "allocate", id });
    const result = this.search(state, process.requestedMemory);
    this.attempt(state, process, result);
    state.lastDecision = {
      processId: id,
      success: result.success,
      searches: result.checkedBlocks.length,
      remaining: result.leftover,
      mode: state.mode,
    };
    if (!result.success)
      return this.failure(state, process, result, process.requestedMemory);
    const index = state.memory.findIndex(
      (b) => b.id === result.selectedBlockId,
    );
    const block = state.memory[index];
    const capacity =
      state.mode === "fixed" ? block.size : process.requestedMemory;
    const leftover = block.size - capacity;
    Object.assign(block, {
      size: capacity,
      free: false,
      processId: id,
      processName: process.name,
    });
    if (leftover)
      state.memory.splice(index + 1, 0, this.freeBlock(state, leftover));
    Object.assign(process, {
      allocatedMemory: capacity,
      blockId: block.id,
      status: "allocated",
      allocationStep: state.step + 1,
    });
    state.metrics.successes++;
    state.lastFailure = null;
    this.addresses(state);
    if (state.algorithm === "next-fit")
      state.nextFitAddress = (block.endAddress + 1) % state.totalMemory;
    this.event(
      state,
      `${id} allocated ${capacity} MB for ${process.requestedMemory} MB using ${formatAlgorithmName(state.algorithm)}; examined ${result.checkedBlocks.length} free blocks.`,
    );
    return { success: true, process, block, algorithmResult: result };
  },

  merge(state) {
    if (state.mode === "fixed") return 0;
    const merged = [];
    let count = 0;
    for (const block of state.memory) {
      const previous = merged[merged.length - 1];
      if (previous?.free && block.free) {
        previous.size += block.size;
        count++;
      } else merged.push(block);
    }
    state.memory = merged;
    this.addresses(state);
    return count;
  },

  terminate(state, id, record = true) {
    const process = state.processes.find((p) => p.id === id);
    if (!process || process.status !== "allocated")
      return {
        success: false,
        message: "Process does not currently hold memory.",
      };
    const block = state.memory.find((b) => b.processId === id);
    const releasedMemory = block.size;
    Object.assign(block, { free: true, processId: null, processName: null });
    Object.assign(process, {
      status: "terminated",
      allocatedMemory: 0,
      blockId: null,
      terminationStep: state.step + 1,
    });
    if (record) state.workload.push({ type: "terminate", id });
    this.event(state, `${id} terminated; ${releasedMemory} MB released.`);
    const count = this.merge(state);
    if (count)
      this.event(state, `${count} adjacent free-block boundaries merged.`);
    return { success: true, releasedMemory };
  },

  grow(state, id, size, record = true) {
    const process = state.processes.find((p) => p.id === id);
    if (!process || process.status !== "allocated")
      return { success: false, message: "Process is not allocated." };
    if (
      !Number.isSafeInteger(size) ||
      size <= 0 ||
      !Number.isSafeInteger(size + process.requestedMemory)
    )
      return {
        success: false,
        message: "Additional memory must be a positive, safe whole MB value.",
      };
    if (record) state.workload.push({ type: "grow", id, size });
    const index = state.memory.findIndex((b) => b.processId === id);
    const block = state.memory[index];
    // Coalesce contiguous holes before checking growth, without changing fixed partition boundaries.
    const merged = this.merge(state);
    if (merged)
      this.event(
        state,
        `${merged} adjacent free-block boundaries merged before growth.`,
      );
    const next = state.memory[state.memory.indexOf(block) + 1];
    const available =
      state.mode === "fixed"
        ? block.size - process.requestedMemory
        : next?.free
          ? next.size
          : 0;
    const result = {
      checkedBlocks:
        next?.free && state.mode === "variable"
          ? [{ blockId: next.id, size: next.size, suitable: available >= size }]
          : [],
    };
    this.attempt(state, process, result);
    if (available < size)
      return this.failure(state, process, result, size, true);
    process.requestedMemory += size;
    if (state.mode === "variable") {
      block.size += size;
      next.size -= size;
      if (!next.size) state.memory.splice(state.memory.indexOf(next), 1);
      process.allocatedMemory += size;
    }
    state.metrics.successes++;
    state.lastFailure = null;
    this.addresses(state);
    this.event(
      state,
      `${id} received ${size} MB additional memory; requested total ${process.requestedMemory} MB, reserved ${process.allocatedMemory} MB.`,
    );
    return {
      success: true,
      additionalMemory: size,
      newAllocation: process.allocatedMemory,
    };
  },

  compact(state, record = true) {
    if (state.mode === "fixed")
      return {
        success: false,
        message:
          "Compaction is available only in variable partition mode; fixed boundaries must remain intact.",
      };
    if (!state.totalMemory)
      return { success: false, message: "Configure memory first." };
    const before = this.statistics(state);
    const beforeLayout = state.memory.map((block) => ({ ...block }));
    const oldAddresses = new Map(
      state.memory.filter((b) => !b.free).map((b) => [b.id, b.startAddress]),
    );
    state.memory = state.memory.filter((b) => !b.free);
    if (before.freeMemory)
      state.memory.push(this.freeBlock(state, before.freeMemory));
    this.addresses(state);
    const moved = state.memory.filter(
      (b) => !b.free && oldAddresses.get(b.id) !== b.startAddress,
    ).length;
    // Relocation invalidates the old search position; start a fresh circular scan.
    state.nextFitAddress = 0;
    state.compactionCount++;
    const after = this.statistics(state);
    state.lastCompaction = {
      before,
      after,
      beforeLayout,
      afterLayout: state.memory.map((block) => ({ ...block })),
      moved,
      step: state.step + 1,
    };
    if (record) state.workload.push({ type: "compact" });
    this.event(
      state,
      `Memory compacted; ${moved} processes moved. Free memory unchanged: ${before.freeMemory} → ${after.freeMemory} MB; largest hole ${before.largestFreeBlock} → ${after.largestFreeBlock} MB; external fragmentation ${before.externalFragmentation} → ${after.externalFragmentation} MB.`,
    );
    return { success: true, ...state.lastCompaction };
  },

  apply(state, action, record = false) {
    switch (action.type) {
      case "note":
        if (typeof action.message !== "string" || action.message.length > 500)
          return { success: false, message: "Invalid event note." };
        if (record)
          state.workload.push({ type: "note", message: action.message });
        this.event(state, action.message);
        return { success: true };
      case "algorithm":
        if (!Object.hasOwn(this.algorithms, action.algorithm))
          return { success: false, message: "Invalid algorithm." };
        state.algorithm = action.algorithm;
        if (record)
          state.workload.push({
            type: "algorithm",
            algorithm: action.algorithm,
          });
        this.event(
          state,
          `Algorithm changed to ${formatAlgorithmName(action.algorithm)}.`,
        );
        return { success: true };
      case "create":
        return this.create(state, action.id, action.name, action.size, record);
      case "allocate":
        return this.allocate(state, action.id, record);
      case "terminate":
        return this.terminate(state, action.id, record);
      case "grow":
        return this.grow(state, action.id, action.size, record);
      case "compact":
        return this.compact(state, record);
      default:
        throw new Error(`Unknown workload action: ${action.type}`);
    }
  },
};
