// Page dialogs avoid native alert/prompt interruptions in embedded browsers.
function simulationDialog(message, input = false) {
  const dialog = document.getElementById("simulationDialog");
  if (dialog.open) return Promise.resolve(input ? null : false);
  const form = document.getElementById("dialogForm");
  const field = document.getElementById("dialogMemory");
  const cancel = document.getElementById("dialogCancel");
  document.getElementById("dialogTitle").textContent = input
    ? "Request Additional Memory"
    : "Confirm Simulation Change";
  document.getElementById("dialogMessage").textContent = message;
  document
    .getElementById("dialogInputGroup")
    .classList.toggle("hidden", !input);
  field.required = input;
  field.disabled = !input;
  field.value = "";
  dialog.returnValue = "cancel";
  return new Promise((resolve) => {
    const submit = (event) => {
      event.preventDefault();
      dialog.close("confirm");
    };
    const dismiss = () => dialog.close("cancel");
    const close = () => {
      form.removeEventListener("submit", submit);
      cancel.removeEventListener("click", dismiss);
      resolve(
        dialog.returnValue === "confirm"
          ? input
            ? field.value
            : true
          : input
            ? null
            : false,
      );
    };
    form.addEventListener("submit", submit);
    cancel.addEventListener("click", dismiss);
    dialog.addEventListener("close", close, { once: true });
    dialog.showModal();
    if (input) field.focus();
  });
}
function confirmSimulationAction(message) {
  return simulationDialog(message);
}
function requestMemoryAmount(message) {
  return simulationDialog(message, true);
}
