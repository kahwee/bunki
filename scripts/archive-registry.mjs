import { createHash } from "node:crypto";

const stable = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function compareVersions(a, b) {
  if (!stable.test(a) || !stable.test(b)) throw new Error("Invalid stable registry version");
  const left = a.split(".");
  const right = b.split(".");
  for (let i = 0; i < 3; i++) {
    if (left[i].length !== right[i].length) return left[i].length < right[i].length ? -1 : 1;
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return 0;
}

export function archiveIntegrity(bytes) {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}

async function metadata(pkg, request) {
  const response = await request(`https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`, {
    signal: AbortSignal.timeout(15000),
    headers: { accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (response.status !== 200) throw new Error(`Registry lookup failed (HTTP ${response.status})`);
  const data = await response.json();
  if (
    !data ||
    data.name !== pkg.name ||
    !data.versions ||
    typeof data.versions !== "object" ||
    Array.isArray(data.versions) ||
    !data["dist-tags"] ||
    typeof data["dist-tags"] !== "object" ||
    Array.isArray(data["dist-tags"])
  ) {
    throw new Error("Malformed or inconsistent registry metadata");
  }
  const latest = data["dist-tags"].latest;
  if (typeof latest !== "string" || !stable.test(latest) || !Object.hasOwn(data.versions, latest)) {
    throw new Error("Malformed registry latest metadata");
  }
  const latestEntry = data.versions[latest];
  if (!latestEntry || latestEntry.name !== pkg.name || latestEntry.version !== latest) {
    throw new Error("Registry latest identity mismatch");
  }
  return data;
}

function checkArchive(pkg, entry, integrity) {
  if (!entry || entry.name !== pkg.name || entry.version !== pkg.version)
    throw new Error("Registry version identity mismatch");
  if (typeof entry.dist?.integrity !== "string" || entry.dist.integrity !== integrity)
    throw new Error("Registry archive integrity mismatch");
}

export async function registryState(pkg, integrity, request = fetch) {
  const data = await metadata(pkg, request);
  if (!data) throw new Error("Registry package not found; publication stopped");
  if (Object.hasOwn(data.versions, pkg.version)) {
    checkArchive(pkg, data.versions[pkg.version], integrity);
    return "published";
  }
  if (compareVersions(data["dist-tags"].latest, pkg.version) >= 0) {
    throw new Error("Refusing to publish an older or inconsistent version to latest");
  }
  return "new";
}

export async function verifyPublished(
  pkg,
  integrity,
  {
    request = fetch,
    sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    attempts = 6,
    delay = 5000,
  } = {},
) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    const data = await metadata(pkg, request);
    if (data && Object.hasOwn(data.versions, pkg.version)) {
      checkArchive(pkg, data.versions[pkg.version], integrity);
      if (compareVersions(data["dist-tags"].latest, pkg.version) >= 0) return;
    }
    if (attempt + 1 < attempts) await sleep(delay);
  }
  throw new Error(`Registry verification exhausted ${attempts} attempts`);
}
