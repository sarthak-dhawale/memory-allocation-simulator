# Interactive Memory Allocation Simulator

An interactive Operating Systems project for understanding contiguous memory allocation through visual simulations, step-by-step execution, and algorithm comparisons.

Explore **First Fit, Best Fit, Worst Fit, and Next Fit** to see how operating systems allocate memory, why allocation requests sometimes fail despite sufficient total free space, and how compaction can reduce external fragmentation.

**Developed by:** Sarthak Dhawale, Umang Vekariya, and Aditya Khunt  
**Technology:** HTML, CSS, and JavaScript  
**Project domain:** Operating Systems

---

## Overview

Memory allocation is an important responsibility of an operating system. When processes request memory, the operating system must identify a suitable contiguous region while managing available space efficiently.

Different allocation strategies can produce different memory layouts, search costs, and fragmentation patterns, even when given the same workload.

This simulator makes those decisions visible through an interactive memory map, process lifecycle records, algorithm comparisons, and step-by-step explanations. It supports both **fixed and variable partitioning**.

> This is an educational simulation. It does not allocate real system RAM or interact with the operating-system kernel.

## Features

| Feature | Description |
| --- | --- |
| Four allocation algorithms | Explore First Fit, Best Fit, Worst Fit, and Next Fit. |
| Fixed and variable partitioning | Compare whole-partition allocation with variable-sized memory regions. |
| Process lifecycle management | Create, allocate, grow, and release simulated processes. |
| Interactive memory map | Inspect memory addresses, allocated regions, requested sizes, reserved sizes, and waste. |
| Next Fit pointer | Observe the saved search position during allocation and in comparison snapshots. |
| Fragmentation analysis | Understand internal and external fragmentation using live metrics. |
| Memory compaction | Merge scattered free regions and inspect address changes before and after compaction. |
| Step-by-step execution | Advance through allocation decisions, pause playback, and adjust playback speed. |
| Algorithm comparison | Compare independent memory states, allocation success, utilization, fragmentation, and search effort. |
| Guided demonstrations | Explore a guided fragmentation lesson and five predefined workloads. |
| Allocation preview | Predict where a request would be placed under each strategy without allocating it. |
| Saved workloads | Export and import JSON workloads for later experiments. |
| Reports | Export standalone HTML reports that can be printed or saved as PDF. |
| Session persistence | Restore saved actions and configuration after refreshing the browser. |
| Responsive interface | Use light and dark themes with layouts adapted to smaller screens. |

The Overview section also includes an independent **200 MB allocation example** for exploring placement strategies before starting a full simulation.

## Quick Start

### Requirements

- A modern web browser.
- Python 3, if you want to run a local development server.
- Node.js, only if you want to run the automated checks.

No backend, database, package installation, or build step is required to run the simulator.

### Option 1: Run using a local server

Clone the repository:

```bash
git clone https://github.com/sarthak-dhawale/memory-allocation-simulator.git
cd memory-allocation-simulator
```

Start a local server using Python 3:

```bash
python -m http.server 8001 --bind 127.0.0.1
```

Open the following address in your browser:

**http://127.0.0.1:8001/**

To stop the server, press `Ctrl + C` in the terminal.

If port `8001` is already in use, select another available port and open the corresponding address.

### Option 2: Open directly

Open `index.html` in a modern browser.

A local server is recommended for consistent browser behavior.

## Try the Simulator

### 1. External Fragmentation
Start the guided demo in **Simulation Studio**. Release processes to create 550 MB of free memory, with the largest hole being 250 MB. A 400 MB request fails until compaction combines the free regions into a 550 MB block.

### 2. Compare Allocation Strategies
Load the **Algorithm Comparison** scenario. For requests of 212 MB, 417 MB, 112 MB, and 426 MB, Best Fit places all four requests, while the other three strategies place three.

### 3. Internal Fragmentation
Select **Fixed Partitioning**, configure 300 MB and 500 MB partitions, and allocate a 200 MB process using First Fit. The 300 MB partition leaves 100 MB of internal waste.

## Allocation Algorithms

| Algorithm | Placement rule |
| --- | --- |
| First Fit | Selects the first free region large enough for the request. |
| Best Fit | Selects the smallest free region that can accommodate the request. |
| Worst Fit | Selects the largest available free region. |
| Next Fit | Searches from its saved position and wraps around to the beginning when necessary. |

All four algorithms have a worst-case search complexity of **O(n)** with the current region-list representation.

First Fit and Next Fit may stop searching early when a suitable region is found. Best Fit and Worst Fit examine all free regions to identify their placement.

## Memory Management and Metrics

### Allocation Rules
- **Variable partitioning:** Allocates memory based on request size and merges adjacent free spaces.
- **Fixed partitioning:** Uses predefined partitions and may waste unused space.
- **Compaction:** Combines scattered free spaces into one larger block.

### Metrics Explained

| Metric | Definition |
| --- | --- |
| Reserved utilization | Reserved allocated memory divided by total memory, multiplied by 100. |
| Useful utilization | Requested memory of allocated processes divided by total memory, multiplied by 100. |
| Internal fragmentation | Sum of reserved size minus requested size for allocated processes. |
| External fragmentation | In variable mode, total free memory minus the largest individual free region. |
| Search effort | Number of free regions examined during allocation and growth attempts. |

These metrics help distinguish useful memory occupancy from reserved space and show why total free memory alone does not determine whether an allocation will succeed.

### Algorithm Comparison and Recommendation Score

The simulator compares allocation success, memory utilization, fragmentation, and search effort across all four algorithms: First Fit, Best Fit, Worst Fit, and Next Fit.

The score is intended to compare strategies within the simulator. It is not a universal measure of algorithm performance.

## Saved Sessions and Reports

The simulator stores committed actions and configuration in browser-local storage. After a refresh, the application reconstructs the session by replaying saved actions.

- **Save Workload:** Download the current workload as JSON.
- **Load Workload:** Import a JSON workload for validation and replay.
- **Export Report:** Download a standalone HTML report that can be opened in a browser and printed or saved as PDF.

Unfinished previews and playback reset after a refresh. Comparison results should be rerun after loading or changing a workload.

Browser-local storage is specific to the browser environment. It is not an online account or shared database.

## Project Structure

The project is organized into separate directories for styling and JavaScript functionality.

```text
memory-allocation-simulator/
├── css/
│   └── style.css
├── js/
│   ├── core/
│   │   ├── algorithms.js
│   │   └── memory-engine.js
│   ├── interface/
│   │   ├── analytics.js
│   │   ├── block-inspector.js
│   │   ├── dialogs.js
│   │   ├── lab-features.js
│   │   ├── learning-views.js
│   │   ├── overview-demo.js
│   │   ├── scenarios.js
│   │   ├── studio-tools.js
│   │   ├── visualization.js
│   │   └── workspace.js
│   └── app.js
├── .gitignore
├── .prettierrc
├── index.html
└── README.md
```

- **`index.html`** provides the main application structure.
- **`css/style.css`** contains the interface styling and theme rules.
- **`js/core/`** contains the allocation algorithms and memory-management engine.
- **`js/interface/`** contains visualization, workspace, analytics, scenario, and interaction modules.
- **`js/app.js`** coordinates application initialization and functionality.
- **`.gitignore`** excludes specified local and generated files from version control.
- **`.prettierrc`** stores the code-formatting configuration.

## Project Team

- **Sarthak Dhawale**
- **Umang Vekariya**
- **Aditya Khunt**

Developed as an academic **Operating Systems project** to demonstrate contiguous memory allocation, fragmentation, compaction, and algorithm comparison through interactive visualization.