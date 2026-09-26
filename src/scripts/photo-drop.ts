const storageKey = (id: string) => `work-photo-${id}`;

function isImageFile(file: File) {
  if (file.type.startsWith("image/")) return true;
  // Some screenshots arrive with an empty MIME type
  return /\.(png|jpe?g|webp|gif)$/i.test(file.name);
}

function getDroppedFile(dataTransfer: DataTransfer | null) {
  if (!dataTransfer) return null;
  const fromFiles = dataTransfer.files?.[0];
  if (fromFiles) return fromFiles;
  for (const item of dataTransfer.items) {
    if (item.kind === "file") {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

function setFilled(slot: HTMLElement, filled: boolean) {
  const drop = slot.querySelector(".photo-drop");
  const zone = slot.querySelector("[data-photo-dropzone]");
  drop?.classList.toggle("border-dashed", !filled);
  drop?.classList.toggle("border-line-strong", !filled);
  drop?.classList.toggle("border-line", filled);
  zone?.classList.toggle("hidden", filled);
}

function showImage(slot: HTMLElement, src: string) {
  const img = slot.querySelector("[data-photo-img]") as HTMLImageElement | null;
  if (!img) return;
  img.src = src;
  img.classList.remove("hidden");
  img.classList.add("object-cover");
  img.classList.remove("object-contain");
  setFilled(slot, true);
}

function savePhoto(id: string, dataUrl: string) {
  try {
    localStorage.setItem(storageKey(id), dataUrl);
  } catch {
    // Browser storage is often full after a couple of large screenshots.
    // Still show the photo for this visit.
    try {
      localStorage.removeItem(storageKey(id));
      localStorage.setItem(storageKey(id), dataUrl);
    } catch {
      console.warn(
        "Could not save photo in the browser (storage full). It will still show until you refresh.",
      );
    }
  }
}

function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Could not read file"));
        return;
      }

      const image = new Image();
      image.onerror = () => reject(new Error("Could not load image"));
      image.onload = () => {
        const maxSize = 1200;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      image.src = result;
    };
    reader.readAsDataURL(file);
  });
}

async function readFile(slot: HTMLElement, file: File) {
  if (!isImageFile(file)) return;
  try {
    const dataUrl = await compressImage(file);
    const id = slot.dataset.photoSlot;
    if (id) savePhoto(id, dataUrl);
    showImage(slot, dataUrl);
  } catch (error) {
    console.warn(error);
  }
}

export function bindAllPhotoSlots() {
  document.querySelectorAll<HTMLElement>("[data-photo-slot]").forEach((slot) => {
    if (slot.dataset.photoBound === "true") return;
    slot.dataset.photoBound = "true";

    const id = slot.dataset.photoSlot;
    const img = slot.querySelector(
      "[data-photo-img]",
    ) as HTMLImageElement | null;
    const input = slot.querySelector(
      "[data-photo-input]",
    ) as HTMLInputElement | null;
    const drop = slot.querySelector(".photo-drop");

    if (id && img && !img.getAttribute("src")) {
      const saved = localStorage.getItem(storageKey(id));
      if (saved) showImage(slot, saved);
    }

    input?.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) void readFile(slot, file);
      input.value = "";
    });

    drop?.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
      drop.classList.add("bg-surface-muted");
    });

    drop?.addEventListener("dragleave", (event) => {
      const related = (event as DragEvent).relatedTarget as Node | null;
      if (related && drop.contains(related)) return;
      drop.classList.remove("bg-surface-muted");
    });

    drop?.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      drop.classList.remove("bg-surface-muted");
      const file = getDroppedFile((event as DragEvent).dataTransfer);
      if (file) void readFile(slot, file);
    });
  });
}
