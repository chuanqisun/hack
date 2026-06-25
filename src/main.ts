import * as esbuild from "esbuild-wasm";
import wasmURL from "esbuild-wasm/esbuild.wasm?url";
import { idbFs } from "./db/idb-fs";
import { virtualFsPlugin } from "./esbuild/vfs";
import "./style.css";

console.log("app online");

// Mock files to load into our virtual filesystem
const files = {
  "/src/index.js": `
    import { msg } from "./message.js";
    import React from "react";

    console.log(msg, React);
    document.body.innerHTML = \`
      <div style="font-family: sans-serif; padding: 20px; text-align: center;">
        <h1>\${msg}</h1>
        <p>Using: React version \${React.version}</p>
        <button id="btn" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">Click Me</button>
        <p id="msg-container" style="margin-top: 20px; font-weight: bold; color: #aa3bff;"></p>
      </div>
    \`;

    document.getElementById("btn")?.addEventListener("click", () => {
      document.getElementById("msg-container").innerText = "Interactive app working in iframe!";
    });
  `,

  "/src/message.js": `
    export const msg = "Hello from virtual file system";
  `,

  "/node_modules/react/index.js": `
    export default { version: "fake-react" };
  `,
};

// UI Elements
const fileListElement = document.getElementById("file-list") as HTMLDivElement;
const addFileBtn = document.getElementById("add-file-btn") as HTMLButtonElement;
const activeFilename = document.getElementById("active-filename") as HTMLHeadingElement;
const fileContentTextArea = document.getElementById("file-content") as HTMLTextAreaElement;
const saveFileBtn = document.getElementById("save-file-btn") as HTMLButtonElement;
const deleteFileBtn = document.getElementById("delete-file-btn") as HTMLButtonElement;
const runBtn = document.getElementById("run-btn") as HTMLButtonElement;
const previewIframe = document.getElementById("preview-iframe") as HTMLIFrameElement;

let currentlyEditingPath: string | null = null;
let esbuildInitialized = false;

async function populateInitialFiles() {
  const existingFiles = await idbFs.allFiles();
  if (existingFiles.length === 0) {
    for (const [path, content] of Object.entries(files)) {
      await idbFs.write(path, content);
    }
  }
}

async function refreshFileList() {
  const allFiles = await idbFs.allFiles();
  fileListElement.innerHTML = "";

  if (allFiles.length === 0) {
    fileListElement.innerHTML = `<div class="empty-list">No files. Click + Add File below.</div>`;
    return;
  }

  allFiles.forEach((filePath) => {
    const item = document.createElement("div");
    item.className = "file-item" + (filePath === currentlyEditingPath ? " active" : "");
    
    const label = document.createElement("span");
    label.textContent = filePath;
    label.className = "file-item-label";
    label.addEventListener("click", () => selectFile(filePath));

    item.appendChild(label);
    fileListElement.appendChild(item);
  });
}

async function selectFile(path: string) {
  currentlyEditingPath = path;
  activeFilename.textContent = path;
  
  try {
    const rawContent = await idbFs.read(path);
    const content = typeof rawContent === "string" ? rawContent : new TextDecoder().decode(rawContent);
    fileContentTextArea.value = content;
    fileContentTextArea.disabled = false;
    saveFileBtn.disabled = false;
    deleteFileBtn.disabled = false;
  } catch (error) {
    console.error("Error reading file:", error);
    alert("Error reading file");
  }

  refreshFileList();
}

async function saveCurrentFile() {
  if (!currentlyEditingPath) return;
  const content = fileContentTextArea.value;
  try {
    await idbFs.write(currentlyEditingPath, content);
    alert(`Saved ${currentlyEditingPath}`);
  } catch (err: any) {
    alert(`Error saving file: ${err.message}`);
  }
}

async function deleteCurrentFile() {
  if (!currentlyEditingPath) return;
  if (confirm(`Are you sure you want to delete ${currentlyEditingPath}?`)) {
    try {
      await idbFs.delete(currentlyEditingPath);
      currentlyEditingPath = null;
      activeFilename.textContent = "Select a file from the list";
      fileContentTextArea.value = "";
      fileContentTextArea.disabled = true;
      saveFileBtn.disabled = true;
      deleteFileBtn.disabled = true;
      await refreshFileList();
    } catch (err: any) {
      alert(`Error deleting file: ${err.message}`);
    }
  }
}

async function createNewFile() {
  const path = prompt("Enter full file path (e.g. /src/utils.js):", "/src/");
  if (!path) return;
  
  if (path === "/" || !path.startsWith("/")) {
    alert("Paths must start with '/' and not be empty");
    return;
  }

  try {
    await idbFs.write(path, "");
    currentlyEditingPath = path;
    await refreshFileList();
    await selectFile(path);
  } catch (err: any) {
    alert(`Error creating file: ${err.message}`);
  }
}

async function compileAndRun() {
  runBtn.disabled = true;
  runBtn.textContent = "Compiling...";

  try {
    if (!esbuildInitialized) {
      await esbuild.initialize({ wasmURL, worker: true });
      esbuildInitialized = true;
    }

    // Check if the entry point of the app exists
    const filesInFs = await idbFs.allFiles();
    let entryPoint = "/src/index.js";
    if (!filesInFs.includes(entryPoint)) {
      // Find any /src/** index or js files as custom entry point fallbacks, or find any remaining js files
      const jsFiles = filesInFs.filter(f => f.endsWith(".js") || f.endsWith(".ts") || f.endsWith(".jsx") || f.endsWith(".tsx"));
      if (jsFiles.length > 0) {
        entryPoint = jsFiles[0];
      } else {
        throw new Error("No bundleable entry-point (.js, .ts, .jsx, .tsx) files found in filesystem.");
      }
    }

    const result = await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      write: false,
      format: "esm",
      plugins: [virtualFsPlugin],
    });

    const outputText = result.outputFiles[0].text;
    console.log("ESBuild compilation success:", entryPoint);

    // Create iframe document content with compiled esm bundle
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Preview Runner</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #fff; color: #333; margin: 0; padding: 10px; }
          </style>
        </head>
        <body>
          <script type="module">
            ${outputText}
          </script>
        </body>
      </html>
    `;

    // Load in iframe using blob URL or srcdoc
    previewIframe.srcdoc = htmlContent;
  } catch (error: any) {
    console.error("Compilation error:", error);
    const errorHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Build Error</title>
          <style>
            body { background: #fdf2f2; color: #9b1c1c; font-family: monospace; padding: 20px; margin: 0; }
            h1 { font-size: 18px; margin: 0 0 10px; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
          </style>
        </head>
        <body>
          <h1>Build Error</h1>
          <pre>${escapeHtml(error.message || String(error))}</pre>
        </body>
      </html>
    `;
    previewIframe.srcdoc = errorHtml;
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = "▶ Run App";
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function main() {
  await populateInitialFiles();
  await refreshFileList();

  // Set up event listeners
  saveFileBtn.addEventListener("click", saveCurrentFile);
  deleteFileBtn.addEventListener("click", deleteCurrentFile);
  addFileBtn.addEventListener("click", createNewFile);
  runBtn.addEventListener("click", compileAndRun);

  // Automatically select the first file is possible
  const allFiles = await idbFs.allFiles();
  const indexJs = allFiles.find(f => f.includes("index.js"));
  if (indexJs) {
    await selectFile(indexJs);
  } else if (allFiles.length > 0) {
    await selectFile(allFiles[0]);
  }

  // Pre-load run once
  await compileAndRun();
}

main();
