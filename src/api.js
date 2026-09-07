/* ============================================================
   VOV AI - API client

   One place for every backend call, so the UI never builds URLs
   by hand and error handling is consistent.
   ============================================================ */

export const API_URL = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8001"
).replace(/\/$/, "");

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;

    try {
      const body = await response.json();
      detail = body.detail || body.message || detail;
    } catch {
      /* response had no JSON body */
    }

    throw new Error(detail);
  }

  if (response.status === 204) return null;

  return response.json();
}

/* ---------------- system ---------------- */

export const getHealth = () => request("/health");
export const getModels = (refresh = false) =>
  request(`/models${refresh ? "?refresh=true" : ""}`);

/* ---------------- sessions ---------------- */

export const listSessions = () => request("/sessions");
export const createSession = () => request("/sessions", { method: "POST" });
export const getSession = (id) => request(`/sessions/${id}`);
export const deleteSession = (id) =>
  request(`/sessions/${id}`, { method: "DELETE" });
export const clearSessions = () => request("/sessions", { method: "DELETE" });

export const renameSession = (id, title) =>
  request(`/sessions/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });

/* ---------------- chat ---------------- */

export const sendChat = (payload) =>
  request("/chat", { method: "POST", body: JSON.stringify(payload) });

/**
 * Read a newline-delimited JSON response body, calling `onChunk` with
 * each decoded line as it arrives.
 *
 * This drives off the network stream itself rather than a JS timer,
 * so - unlike setInterval-based polling - delivery isn't subject to
 * the browser throttling or suspending timers in a backgrounded tab.
 */
async function readNdjsonStream(response, onChunk) {
  if (!response.ok || !response.body) {
    throw new Error(`Stream failed (${response.status})`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;

      try {
        onChunk(JSON.parse(trimmed));
      } catch {
        /* partial or malformed line: skip it */
      }
    }
  }

  if (buffer.trim()) {
    try {
      onChunk(JSON.parse(buffer.trim()));
    } catch {
      /* ignore trailing fragment */
    }
  }
}

/**
 * Stream a chat reply.
 *
 * The backend emits newline-delimited JSON. `onChunk` receives each
 * decoded object. Pass an AbortSignal to let the user stop generation.
 */
export async function streamChat(payload, onChunk, signal) {
  const response = await fetch(`${API_URL}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  await readNdjsonStream(response, onChunk);
}

/* ---------------- projects ---------------- */

export const listProjects = () => request("/projects");
export const getProject = (name) => request(`/project/${name}`);
export const deleteProject = (name) =>
  request(`/project/${name}`, { method: "DELETE" });

export const saveProjectFile = (name, path, content) =>
  request(`/project/${name}/file`, {
    method: "PUT",
    body: JSON.stringify({ path, content }),
  });

export const deleteProjectFile = (name, path) =>
  request(`/project/${name}/file?path=${encodeURIComponent(path)}`, {
    method: "DELETE",
  });

export const downloadUrl = (name) => `${API_URL}/download/${name}`;
export const previewUrl = (name) => `${API_URL}/preview/${name}/index.html`;

/**
 * Save a project's zip straight to disk.
 *
 * The bytes are fetched first and handed to the browser as a blob
 * rather than pointing a link at the backend: the backend is a
 * different origin, where a link would be a real navigation, so a
 * failed download would replace the whole app with an error page.
 * This way a failure is just a rejected promise.
 */
export async function downloadProject(name) {
  const response = await fetch(downloadUrl(name));

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const href = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");

  link.href = href;
  link.download = `${name}.zip`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Give the browser a moment to take the blob before dropping it.
  setTimeout(() => URL.revokeObjectURL(href), 10000);
}

/* ---------------- build ---------------- */

export const startBuild = (payload) =>
  request("/generate", { method: "POST", body: JSON.stringify(payload) });

export const getBuildStatus = (name) => request(`/status/${name}`);
export const listBuilds = () => request("/status");
export const cancelBuild = (name) =>
  request(`/cancel/${name}`, { method: "POST" });

/**
 * Watch a build (or fix run) over the backend's status stream.
 *
 * Resolves when the connection closes, which is not necessarily when
 * the build ends - the server closes an idle stream after a while, and
 * a backgrounded tab can have its connection dropped. Callers must
 * re-attach until a status actually reports finished. The build itself
 * is a server-side background task and keeps running either way.
 */
export async function watchBuildStatus(name, onUpdate, signal) {
  const response = await fetch(`${API_URL}/status/${name}/stream`, { signal });

  await readNdjsonStream(response, onUpdate);
}

export const testProject = (name) =>
  request(`/test/${name}`, { method: "POST" });

/**
 * Kick off an automatic repair. Returns as soon as the backend has
 * queued the fix as a background task - it does not wait for the
 * repair loop to finish. Watch progress with watchBuildStatus, the
 * same as a build.
 */
export const fixProject = (name, model = "auto") =>
  request(`/fix/${name}?model=${encodeURIComponent(model)}`, { method: "POST" });
