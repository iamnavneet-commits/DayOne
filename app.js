const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const el = {
  input: document.getElementById("pdfInput"),
  info: document.getElementById("fileInfo"),
  rotate: document.getElementById("rotateBtn"),
  textForm: document.getElementById("textForm"),
  textPage: document.getElementById("textPage"),
  textX: document.getElementById("textX"),
  textY: document.getElementById("textY"),
  textSize: document.getElementById("textSize"),
  textValue: document.getElementById("textValue"),
  deleteForm: document.getElementById("deleteForm"),
  deletePage: document.getElementById("deletePage"),
  deleteBtn: document.getElementById("deleteBtn"),
  previewPage: document.getElementById("previewPage"),
  previewBtn: document.getElementById("previewBtn"),
  previewCanvas: document.getElementById("previewCanvas"),
  downloadBtn: document.getElementById("downloadBtn"),
  status: document.getElementById("status"),
  addTextBtn: document.getElementById("addTextBtn"),
};

let pdfDoc;
let activeName = "edited.pdf";

function setEnabled(enabled) {
  [
    el.rotate,
    el.addTextBtn,
    el.deleteBtn,
    el.previewBtn,
    el.downloadBtn,
    el.previewPage,
  ].forEach((node) => {
    node.disabled = !enabled;
  });
}

function setStatus(message, isError = false) {
  el.status.textContent = message;
  el.status.style.color = isError ? "#b91c1c" : "#065f46";
}

function pageCount() {
  return pdfDoc ? pdfDoc.getPageCount() : 0;
}

function clampPage(value) {
  return Math.min(Math.max(1, value), pageCount());
}

async function renderPreview(pageNum) {
  if (!pdfDoc) return;
  const bytes = await pdfDoc.save();
  const loadingTask = pdfjsLib.getDocument({ data: bytes });
  const previewDoc = await loadingTask.promise;
  const page = await previewDoc.getPage(pageNum);

  const viewport = page.getViewport({ scale: 1.2 });
  const canvas = el.previewCanvas;
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;
}

el.input.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    pdfDoc = await PDFDocument.load(bytes);
    activeName = file.name.replace(/\.pdf$/i, "") + "-edited.pdf";

    el.info.textContent = `Loaded ${file.name} (${pageCount()} pages)`;
    const max = String(pageCount());
    [el.textPage, el.deletePage, el.previewPage].forEach((input) => {
      input.max = max;
      input.value = "1";
    });

    setEnabled(true);
    setStatus("PDF loaded. Make your edits.");
    await renderPreview(1);
  } catch {
    setEnabled(false);
    setStatus("Could not open this PDF file.", true);
  }
});

el.rotate.addEventListener("click", () => {
  if (!pdfDoc) return;
  pdfDoc.getPages().forEach((page) => {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + 90) % 360));
  });
  setStatus("Rotated all pages by 90°.");
});

el.textForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pdfDoc) return;

  const index = clampPage(Number(el.textPage.value)) - 1;
  const x = Number(el.textX.value);
  const y = Number(el.textY.value);
  const size = Number(el.textSize.value);
  const text = el.textValue.value.trim();

  if (!text) {
    setStatus("Text cannot be empty.", true);
    return;
  }

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  pdfDoc.getPage(index).drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });

  setStatus(`Added text on page ${index + 1}.`);
  await renderPreview(index + 1);
});

el.deleteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!pdfDoc) return;

  if (pageCount() === 1) {
    setStatus("Cannot delete the last remaining page.", true);
    return;
  }

  const index = clampPage(Number(el.deletePage.value)) - 1;
  pdfDoc.removePage(index);

  const max = String(pageCount());
  [el.textPage, el.deletePage, el.previewPage].forEach((input) => {
    input.max = max;
    input.value = String(Math.min(Number(input.value), pageCount()));
  });

  setStatus(`Deleted page ${index + 1}. ${pageCount()} pages left.`);
  await renderPreview(clampPage(Number(el.previewPage.value)));
});

el.previewBtn.addEventListener("click", async () => {
  if (!pdfDoc) return;
  const pageNum = clampPage(Number(el.previewPage.value));
  el.previewPage.value = String(pageNum);
  await renderPreview(pageNum);
  setStatus(`Rendered preview for page ${pageNum}.`);
});

el.downloadBtn.addEventListener("click", async () => {
  if (!pdfDoc) return;

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = activeName;
  a.click();

  URL.revokeObjectURL(url);
  setStatus("Download started.");
});

setEnabled(false);
