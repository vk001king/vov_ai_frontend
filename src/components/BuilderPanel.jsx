import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileCode2,
  FolderPlus,
  Hammer,
  RefreshCw,
  Save,
  Trash2,
  Wrench,
  XCircle,
} from "lucide-react";

import * as api from "../api.js";

/* ============================================================
   Builder

   The original backend exposed /generate, /status, /project,
   /test and /fix, but the UI had no way to reach any of them.
   This is that missing half: build, watch, inspect, edit,
   preview and download a generated project.
   ============================================================ */

export default function BuilderPanel({ models, model, onModelChange }) {
  const [projects, setProjects] = useState([]);
  const [active, setActive] = useState(null);

  const [projectName, setProjectName] = useState("");
  const [instruction, setInstruction] = useState("");
  const [mode, setMode] = useState("auto");
  const [autoFix, setAutoFix] = useState(true);

  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState("");
  const [dirty, setDirty] = useState(false);

  const [tab, setTab] = useState("code");
  const [previewKey, setPreviewKey] = useState(0);
  const [report, setReport] = useState(null);

  const streamRef = useRef(null);
  const downloadedRef = useRef(new Set());
  const logRef = useRef(null);

  /* ---------------- projects ---------------- */

  const refreshProjects = useCallback(async () => {
    try {
      const data = await api.listProjects();
      setProjects(data.projects || []);
    } catch (caught) {
      setError(caught.message);
    }
  }, []);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const loadFiles = useCallback(async (name) => {
    if (!name) return;

    try {
      const data = await api.getProject(name);
      const list = data.files || [];

      setFiles(list);

      setSelectedFile((current) => {
        const stillThere = list.find((file) => file.name === current);

        if (stillThere) return current;

        const entry =
          list.find((file) => file.name === "index.html") || list[0];

        return entry ? entry.name : null;
      });
    } catch (caught) {
      setError(caught.message);
      setFiles([]);
    }
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setFileContent("");
      return;
    }

    const entry = files.find((file) => file.name === selectedFile);

    setFileContent(entry ? entry.content : "");
    setDirty(false);
  }, [selectedFile, files]);

  async function openProject(name) {
    setActive(name);
    setProjectName(name);
    setReport(null);
    setError("");

    await loadFiles(name);

    const current = await api.getBuildStatus(name).catch(() => null);

    setStatus(current && current.status !== "not_found" ? current : null);
  }

  /* ---------------- build ---------------- */

  const stopWatching = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.abort();
      streamRef.current = null;
    }
  }, []);

  /**
   * Watch a build or fix run through to completion over the backend's
   * status stream. The work itself runs server-side as a background
   * task - started once and left alone - so this is purely a UI sync:
   * it keeps the panel current while it can, but the build keeps
   * going even if this stream is throttled, interrupted, or never
   * reconnected (e.g. the tab was backgrounded or the page reloaded).
   *
   * On a successful finish the project's zip is downloaded straight
   * away, no click required.
   */
  const watchBuild = useCallback(
    (name, { onFinish } = {}) => {
      stopWatching();

      const controller = new AbortController();
      streamRef.current = controller;

      api
        .watchBuildStatus(
          name,
          (current) => {
            setStatus(current);

            if (!current.finished) return;

            stopWatching();
            setBusy(false);

            refreshProjects();
            loadFiles(name);
            setPreviewKey((value) => value + 1);

            const succeeded = current.status !== "failed";

            if (succeeded && !downloadedRef.current.has(name)) {
              downloadedRef.current.add(name);
              api.triggerDownload(name);
            }

            onFinish?.(current, succeeded);
          },
          controller.signal
        )
        .catch((caught) => {
          if (controller.signal.aborted) return; // we cancelled it ourselves

          stopWatching();
          setBusy(false);
          setError(caught.message);
        });
    },
    [loadFiles, refreshProjects, stopWatching]
  );

  useEffect(() => stopWatching, [stopWatching]);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [status]);

  async function build() {
    const name = projectName.trim();

    if (!name || !instruction.trim() || busy) return;

    if (!/^[A-Za-z0-9._-]+$/.test(name)) {
      setError(
        "Project names may contain letters, numbers, dots, dashes and underscores only."
      );
      return;
    }

    setError("");
    setBusy(true);
    setReport(null);
    setActive(name);
    downloadedRef.current.delete(name);
    setStatus({
      status: "starting",
      message: "Sending request to VOV AI...",
      progress: 2,
      log: [],
      completed_files: [],
      errors: [],
    });

    try {
      await api.startBuild({
        project_name: name,
        request: instruction.trim(),
        model,
        mode,
        auto_fix: autoFix,
      });

      watchBuild(name);
    } catch (caught) {
      setBusy(false);
      setError(caught.message);
      setStatus(null);
    }
  }

  async function cancel() {
    if (!active) return;

    await api.cancelBuild(active).catch(() => {});
  }

  /* ---------------- file actions ---------------- */

  async function saveFile() {
    if (!active || !selectedFile) return;

    try {
      await api.saveProjectFile(active, selectedFile, fileContent);

      setFiles((current) =>
        current.map((file) =>
          file.name === selectedFile ? { ...file, content: fileContent } : file
        )
      );

      setDirty(false);
      setPreviewKey((value) => value + 1);
    } catch (caught) {
      setError(caught.message);
    }
  }

  async function runTest() {
    if (!active) return;

    setBusy(true);

    try {
      setReport(await api.testProject(active));
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }

  async function runFix() {
    if (!active || busy) return;

    setError("");
    setBusy(true);
    setReport(null);
    downloadedRef.current.delete(active);

    try {
      // Just queues the repair as a background task and returns - the
      // fix itself can take several model calls, so it keeps running
      // on the server regardless of whether this tab stays in front.
      await api.fixProject(active, model);

      watchBuild(active, {
        onFinish: (current, succeeded) => {
          setReport({
            working: succeeded,
            errors: current.errors || [],
            message: current.message,
          });
        },
      });
    } catch (caught) {
      setBusy(false);
      setError(caught.message);
    }
  }

  async function removeProject(name) {
    if (!window.confirm(`Delete the project "${name}" and all of its files?`)) {
      return;
    }

    try {
      await api.deleteProject(name);

      if (active === name) {
        setActive(null);
        setFiles([]);
        setSelectedFile(null);
        setStatus(null);
      }

      await refreshProjects();
    } catch (caught) {
      setError(caught.message);
    }
  }

  const running = Boolean(status && !status.finished);
  const hasIndex = files.some((file) => file.name === "index.html");

  return (
    <div className="builder">
      {/* ---------------- build form ---------------- */}

      <section className="builderForm">
        <div className="builderFormRow">
          <label>
            <span>Project name</span>

            <input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="my_portfolio"
              spellCheck={false}
            />
          </label>

          <label>
            <span>Mode</span>

            <select value={mode} onChange={(event) => setMode(event.target.value)}>
              <option value="auto">Auto</option>
              <option value="create">Create from scratch</option>
              <option value="modify">Modify existing</option>
            </select>
          </label>

          <label>
            <span>Model</span>

            <select
              value={model}
              onChange={(event) => onModelChange(event.target.value)}
            >
              <option value="auto">Auto</option>

              {models.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <textarea
          className="builderPrompt"
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          placeholder="Describe what to build or change. For example: a dark-themed portfolio site with a project grid, contact form and smooth scrolling."
          rows={3}
        />

        <div className="builderActions">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={autoFix}
              onChange={(event) => setAutoFix(event.target.checked)}
            />
            Auto-repair problems after building
          </label>

          {running ? (
            <button className="dangerButton" onClick={cancel}>
              <XCircle size={15} />
              Cancel build
            </button>
          ) : (
            <button
              className="primaryButton"
              onClick={build}
              disabled={busy || !projectName.trim() || !instruction.trim()}
            >
              <Hammer size={15} />
              Build
            </button>
          )}
        </div>

        {error && <div className="builderError">⚠ {error}</div>}
      </section>

      {/* ---------------- status ---------------- */}

      {status && (
        <section className="buildStatus">
          <div className="buildStatusTop">
            <span className={`statusPill status-${status.status}`}>
              {status.status}
            </span>

            <span className="buildMessage">{status.message}</span>

            {status.model && (
              <span className="modelBadge">{status.model}</span>
            )}
          </div>

          <div className="progressTrack">
            <div
              className="progressBar"
              style={{ width: `${status.progress || 0}%` }}
            />
          </div>

          {Array.isArray(status.log) && status.log.length > 0 && (
            <div className="buildLog" ref={logRef}>
              {status.log.map((entry, index) => (
                <div key={index}>
                  <span className="logTime">
                    {String(entry.at || "").slice(11, 19)}
                  </span>
                  {entry.line}
                </div>
              ))}
            </div>
          )}

          {status.errors?.length > 0 && (
            <div className="buildErrors">
              {status.errors.map((item, index) => (
                <div key={index}>
                  <AlertTriangle size={12} /> {item}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ---------------- workspace ---------------- */}

      <section className="builderBody">
        <div className="projectList">
          <div className="panelHeader">
            <span>Projects</span>

            <button onClick={refreshProjects} title="Refresh">
              <RefreshCw size={13} />
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="noHistory">
              <FolderPlus size={15} />
              No projects yet.
            </div>
          ) : (
            projects.map((project) => (
              <div
                key={project.name}
                className={
                  project.name === active ? "projectItem active" : "projectItem"
                }
              >
                <button onClick={() => openProject(project.name)}>
                  <strong>{project.name}</strong>

                  <span>
                    {project.files} file{project.files === 1 ? "" : "s"} ·{" "}
                    {(project.size / 1024).toFixed(1)} KB
                  </span>
                </button>

                <button
                  className="historyDelete"
                  title="Delete project"
                  onClick={() => removeProject(project.name)}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="workspace">
          {!active ? (
            <div className="workspaceEmpty">
              <FileCode2 size={30} />
              <p>
                Build a new project above, or pick an existing one to inspect
                its files and preview it live.
              </p>
            </div>
          ) : (
            <>
              <div className="workspaceBar">
                <div className="workspaceTabs">
                  <button
                    className={tab === "code" ? "active" : ""}
                    onClick={() => setTab("code")}
                  >
                    <FileCode2 size={13} />
                    Code
                  </button>

                  <button
                    className={tab === "preview" ? "active" : ""}
                    onClick={() => {
                      setTab("preview");
                      setPreviewKey((value) => value + 1);
                    }}
                    disabled={!hasIndex}
                    title={
                      hasIndex
                        ? "Live preview"
                        : "This project has no index.html to preview"
                    }
                  >
                    <Eye size={13} />
                    Preview
                  </button>
                </div>

                <div className="workspaceTools">
                  <button onClick={runTest} disabled={busy} title="Validate">
                    <CheckCircle2 size={13} />
                    Test
                  </button>

                  <button onClick={runFix} disabled={busy} title="Auto-repair">
                    <Wrench size={13} />
                    Fix
                  </button>

                  <a
                    className="toolLink"
                    href={api.downloadUrl(active)}
                    title="Download as .zip"
                  >
                    <Download size={13} />
                    Zip
                  </a>
                </div>
              </div>

              {report && (
                <div
                  className={
                    report.working ? "reportBox reportOk" : "reportBox reportBad"
                  }
                >
                  {report.working ? (
                    <>
                      <CheckCircle2 size={14} />
                      {report.message || "No problems found."}
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={14} />
                      <div>
                        {report.message && <div>{report.message}</div>}

                        {report.errors?.map((item, index) => (
                          <div key={index}>• {item}</div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {tab === "code" ? (
                <div className="codePane">
                  <div className="fileTree">
                    {files.map((file) => (
                      <button
                        key={file.name}
                        className={
                          file.name === selectedFile ? "fileItem active" : "fileItem"
                        }
                        onClick={() => setSelectedFile(file.name)}
                      >
                        {file.name}
                      </button>
                    ))}
                  </div>

                  <div className="editorPane">
                    <div className="editorBar">
                      <span>{selectedFile || "No file selected"}</span>

                      <button
                        className="primaryButton small"
                        onClick={saveFile}
                        disabled={!dirty || !selectedFile}
                      >
                        <Save size={13} />
                        {dirty ? "Save" : "Saved"}
                      </button>
                    </div>

                    <textarea
                      className="editor"
                      value={fileContent}
                      spellCheck={false}
                      onChange={(event) => {
                        setFileContent(event.target.value);
                        setDirty(true);
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="previewPane">
                  <div className="previewBar">
                    <span>{api.previewUrl(active)}</span>

                    <button
                      onClick={() => setPreviewKey((value) => value + 1)}
                      title="Reload preview"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>

                  <iframe
                    key={previewKey}
                    className="previewFrame"
                    title="Project preview"
                    src={`${api.previewUrl(active)}?v=${previewKey}`}
                    sandbox="allow-scripts allow-forms allow-modals allow-popups"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
