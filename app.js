const installButton = document.querySelector("#installButton");
const installToast = document.querySelector("#installToast");
let deferredInstallPrompt = null;
let toastTimer = null;

function showToast(message) {
  installToast.textContent = message;
  installToast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    installToast.classList.remove("visible");
  }, 4200);
}

function isInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function updateInstallButton() {
  if (!isInstalled()) return;
  installButton.querySelector("span").textContent = "Installed";
  installButton.disabled = true;
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  updateInstallButton();
  showToast("Meridian Nexus was installed successfully.");
});

installButton.addEventListener("click", async () => {
  if (isInstalled()) {
    showToast("Meridian Nexus is already installed on this device.");
    return;
  }

  if (!deferredInstallPrompt) {
    showToast("In Chrome or Edge, open the browser menu and choose Install Meridian Nexus.");
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      showToast("Desktop installation will be available after the next refresh.");
    });
  });
}

updateInstallButton();
