// backend/src/exports/excel/utils/filename.js

function safeFilename(name) {
  const base = String(name ?? "export")
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "") // caracteres inválidos Windows
    .replace(/\s+/g, " ")
    .slice(0, 140);

  return base || "export";
}

module.exports = { safeFilename };