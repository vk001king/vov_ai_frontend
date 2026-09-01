const API_URL = "http://127.0.0.1:8000";

let currentProject = "vov_project";
let isGenerating = false;

let completedFiles = new Set();
let activityHistory = [];

// ==========================================
// ELEMENTS
// ==========================================

const sidebar =
document.getElementById("sidebar");

const menuBtn =
document.getElementById("menuBtn");

const newChatBtn =
document.getElementById("newChatBtn");

const projectsNewBtn =
document.getElementById("projectsNewBtn");

const promptInput =
document.getElementById("promptInput");

const sendBtn =
document.getElementById("sendBtn");

const messages =
document.getElementById("messages");

const welcome =
document.getElementById("welcome");

const buildPanel =
document.getElementById("buildPanel");

const activityMessage =
document.getElementById("activityMessage");

const currentFile =
document.getElementById("currentFile");

const activitySpinner =
document.getElementById("activitySpinner");

const fileList =
document.getElementById("fileList");

const progressBar =
document.getElementById("progressBar");

const progressText =
document.getElementById("progressText");

const buildStatusText =
document.getElementById("buildStatusText");

const connectionDot =
document.getElementById("connectionDot");

const connectionText =
document.getElementById("connectionText");

const projectGrid =
document.getElementById("projectGrid");

const recentList =
document.getElementById("recentList");

const activityHistoryElement =
document.getElementById("activityHistory");

const chatPage =
document.getElementById("chatPage");

const projectsPage =
document.getElementById("projectsPage");

const activityPage =
document.getElementById("activityPage");

const previewModal =
document.getElementById("previewModal");

const previewFrame =
document.getElementById("previewFrame");

const previewTitle =
document.getElementById("previewTitle");

const previewStatus =
document.getElementById("previewStatus");

const settingsModal =
document.getElementById("settingsModal");

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener(
"DOMContentLoaded",
() => {

```
    setupSuggestions();

    setupNavigation();

    setupComposer();

    setupModals();

    loadProjects();

    checkBackend();

}
```

);

// ==========================================
// BACKEND CHECK
// ==========================================

async function checkBackend() {

```
setConnection(
    "checking"
);

try {

    const controller =
        new AbortController();

    const timeout =
        setTimeout(
            () => controller.abort(),
            5000
        );

    const response =
        await fetch(
            `${API_URL}/`,
            {
                method: "GET",
                signal: controller.signal
            }
        );

    clearTimeout(timeout);

    if (!response.ok) {
        throw new Error("Backend unavailable");
    }

    const data =
        await response.json();

    setConnection(
        "online",
        data.model
            ? `Online • ${data.model}`
            : "Online"
    );

}

catch (error) {

    console.error(
        "Backend check failed:",
        error
    );

    setConnection(
        "offline",
        "Backend offline"
    );
}
```

}

// ==========================================
// CONNECTION UI
// ==========================================

function setConnection(
status,
text
) {

```
connectionDot.classList.remove(
    "online",
    "offline"
);

if (status === "online") {

    connectionDot.classList.add(
        "online"
    );

    connectionText.textContent =
        text || "Online";

}

else if (status === "offline") {

    connectionDot.classList.add(
        "offline"
    );

    connectionText.textContent =
        text || "Offline";

}

else {

    connectionText.textContent =
        text || "Connecting...";
}
```

}

// ==========================================
// SIDEBAR
// ==========================================

menuBtn.addEventListener(
"click",
() => {

```
    sidebar.classList.toggle(
        "open"
    );

}
```

);

// ==========================================
// SUGGESTIONS
// ==========================================

function setupSuggestions() {

```
document
    .querySelectorAll(
        ".suggestions button"
    )
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                promptInput.value =
                    button.dataset.prompt || "";

                autoResize();

                promptInput.focus();

            }
        );

    });
```

}

// ==========================================
// COMPOSER
// ==========================================

function setupComposer() {

```
sendBtn.addEventListener(
    "click",
    sendMessage
);


promptInput.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);


promptInput.addEventListener(
    "input",
    autoResize
);
```

}

function autoResize() {

```
promptInput.style.height =
    "auto";

promptInput.style.height =
    Math.min(
        promptInput.scrollHeight,
        130
    ) + "px";
```

}

// ==========================================
// SEND MESSAGE
// ==========================================

async function sendMessage() {

```
if (isGenerating) {
    return;
}

const text =
    promptInput.value.trim();

if (!text) {
    return;
}


// --------------------------------------
// SHOW USER MESSAGE
// --------------------------------------

addMessage(
    text,
    "user"
);


// --------------------------------------
// HIDE WELCOME
// --------------------------------------

welcome.classList.add(
    "hidden"
);


// --------------------------------------
// CLEAR INPUT
// --------------------------------------

promptInput.value = "";

promptInput.style.height =
    "auto";


// --------------------------------------
// GENERATE PROJECT NAME
// --------------------------------------

currentProject =
    createProjectName(text);


// --------------------------------------
// BUILD UI
// --------------------------------------

startBuildUI(
    currentProject
);


// --------------------------------------
// DISABLE SEND
// --------------------------------------

isGenerating = true;

sendBtn.disabled = true;


try {

    updateBuild(
        "working",
        "Sending request to VOV AI...",
        "Connecting to Qwen3.5"
    );


    const response =
        await fetch(
            `${API_URL}/generate`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    project_name:
                        currentProject,

                    request:
                        text

                })
            }
        );


    if (!response.ok) {

        throw new Error(
            `Server returned ${response.status}`
        );

    }


    const data =
        await response.json();


    console.log(
        "Generation started:",
        data
    );


    updateBuild(
        "working",
        "Qwen3.5 is working...",
        "Waiting for model output"
    );


    addRecentProject(
        currentProject
    );


    // ----------------------------------
    // START LIVE STATUS MONITOR
    // ----------------------------------

    await monitorBuild();

}

catch (error) {

    console.error(
        error
    );


    updateBuild(
        "error",
        "Could not connect to VOV AI.",
        "Check that FastAPI is running."
    );


    addMessage(
        "❌ I couldn't connect to the VOV AI backend. Make sure FastAPI is running at http://127.0.0.1:8000.",
        "ai"
    );

}

finally {

    isGenerating = false;

    sendBtn.disabled = false;

}
```

}

// ==========================================
// BUILD UI
// ==========================================

function startBuildUI(
projectName
) {

```
buildPanel.classList.remove(
    "hidden"
);

completedFiles.clear();

fileList.innerHTML = "";

progressBar.style.width =
    "5%";

progressText.textContent =
    "5%";

activitySpinner.className =
    "activity-spinner";

buildStatusText.textContent =
    "Starting...";

activityMessage.textContent =
    "Starting VOV AI...";

currentFile.textContent =
    projectName;
```

}

// ==========================================
// BUILD STATUS UPDATE
// ==========================================

function updateBuild(
status,
message,
file
) {

```
activityMessage.textContent =
    message || "Working...";


if (file) {

    currentFile.textContent =
        file;

}


buildStatusText.textContent =
    formatStatus(status);


if (status === "error") {

    activitySpinner.className =
        "activity-spinner error";

}

else if (
    status === "complete" ||
    status === "finished"
) {

    activitySpinner.className =
        "activity-spinner done";

}

else {

    activitySpinner.className =
        "activity-spinner";

}


addActivityHistory(
    message,
    file,
    status
);
```

}

// ==========================================
// STATUS TEXT
// ==========================================

function formatStatus(
status
) {

```
const names = {

    thinking:
        "Thinking",

    planning:
        "Planning",

    generating:
        "Generating",

    creating:
        "Creating",

    generating_file:
        "Building files",

    processing:
        "Processing",

    testing:
        "Testing",

    fixing:
        "Fixing",

    complete:
        "Complete",

    finished:
        "Complete",

    error:
        "Error",

    working:
        "Working"

};

return (
    names[status] ||
    "Working"
);
```

}

// ==========================================
// LIVE BUILD MONITOR
// ==========================================

async function monitorBuild() {

```
let attempts = 0;

const MAX_ATTEMPTS = 900;


while (
    attempts < MAX_ATTEMPTS
) {

    attempts++;


    try {

        const response =
            await fetch(
                `${API_URL}/status/${encodeURIComponent(currentProject)}`,
                {
                    cache: "no-store"
                }
            );


        if (!response.ok) {

            throw new Error(
                `Status ${response.status}`
            );

        }


        const status =
            await response.json();


        console.log(
            "BUILD STATUS:",
            status
        );


        processBuildStatus(
            status
        );


        if (
            status.finished === true ||
            status.finished === "true"
        ) {

            finishBuildUI(
                status
            );

            return;

        }


        await sleep(800);

    }

    catch (error) {

        console.warn(
            "Status check failed:",
            error
        );

        await sleep(1500);

    }

}


updateBuild(
    "error",
    "Build monitor timed out.",
    "Check the backend logs."
);
```

}

// ==========================================
// PROCESS BUILD STATUS
// ==========================================

function processBuildStatus(
status
) {

```
const state =
    status.status ||
    status.state ||
    "working";

const message =
    status.message ||
    status.current_message ||
    "VOV AI is working...";

const file =
    status.current_file ||
    status.file ||
    "";


updateBuild(
    state,
    message,
    file
);


// --------------------------------------
// CURRENT FILE
// --------------------------------------

if (file) {

    showCurrentFile(
        file
    );

}


// --------------------------------------
// COMPLETED FILES
// --------------------------------------

const files =
    normalizeFiles(
        status.completed_files
    );


files.forEach(
    markFileComplete
);


// --------------------------------------
// PROGRESS
// --------------------------------------

calculateProgress(
    state,
    files,
    file
);
```

}

// ==========================================
// NORMALIZE FILE LIST
// ==========================================

function normalizeFiles(
files
) {

```
if (!files) {
    return [];
}


if (Array.isArray(files)) {
    return files;
}


if (typeof files === "object") {

    return Object.keys(files);

}


return [];
```

}

// ==========================================
// CURRENT FILE
// ==========================================

function showCurrentFile(
filename
) {

```
currentFile.textContent =
    `Working on ${filename}`;


let item =
    document.querySelector(
        `[data-file="${cssEscape(filename)}"]`
    );


if (!item) {

    item =
        document.createElement("div");

    item.className =
        "file-item active";

    item.dataset.file =
        filename;

    item.innerHTML = `

        <span class="file-icon">
            ●
        </span>

        <span>
            ${escapeHtml(filename)}
        </span>

    `;

    fileList.appendChild(
        item
    );

}


document
    .querySelectorAll(
        ".file-item.active"
    )
    .forEach(
        element => {

            if (
                element.dataset.file !==
                filename
            ) {

                element.classList.remove(
                    "active"
                );

            }

        }
    );
```

}

// ==========================================
// COMPLETE FILE
// ==========================================

function markFileComplete(
filename
) {

```
if (
    completedFiles.has(
        filename
    )
) {

    return;

}


completedFiles.add(
    filename
);


let item =
    document.querySelector(
        `[data-file="${cssEscape(filename)}"]`
    );


if (!item) {

    item =
        document.createElement("div");

    item.className =
        "file-item";

    item.dataset.file =
        filename;

    item.innerHTML = `

        <span class="file-icon">
            ✓
        </span>

        <span>
            ${escapeHtml(filename)}
        </span>

    `;

    fileList.appendChild(
        item
    );

}


item.classList.remove(
    "active"
);

item.classList.add(
    "complete"
);


item.querySelector(
    ".file-icon"
).textContent =
    "✓";
```

}

// ==========================================
// PROGRESS
// ==========================================

function calculateProgress(
state,
files,
current
) {

```
let progress = 10;


if (state === "thinking") {
    progress = 15;
}

else if (state === "planning") {
    progress = 20;
}

else if (state === "generating") {
    progress = 30;
}

else if (state === "creating") {
    progress = 40;
}

else if (state === "generating_file") {

    progress =
        Math.min(
            85,
            40 + files.length * 12
        );

}

else if (state === "processing") {
    progress = 88;
}

else if (state === "testing") {
    progress = 94;
}

else if (
    state === "complete" ||
    state === "finished"
) {
    progress = 100;
}


progressBar.style.width =
    `${progress}%`;

progressText.textContent =
    `${progress}%`;
```

}

// ==========================================
// FINISH BUILD
// ==========================================

function finishBuildUI(
status
) {

```
const errors =
    normalizeErrors(
        status.errors
    );


if (
    errors.length > 0 ||
    status.working === false
) {

    updateBuild(
        "error",
        status.message ||
            "Project generated with errors.",
        errors[0] ||
            "Check the project."
    );

    progressBar.style.width =
        "100%";

    progressText.textContent =
        "Done";

    addMessage(
        "⚠️ VOV AI finished the build, but the project needs attention.",
        "ai"
    );

    return;

}


updateBuild(
    "complete",
    status.message ||
        "Project generated successfully!",
    "Build complete"
);


progressBar.style.width =
    "100%";

progressText.textContent =
    "100%";


addMessage(
    `✅ ${currentProject} is ready.`,
    "ai"
);


setTimeout(
    () => {

        buildPanel.classList.add(
            "hidden"
        );

    },
    2500
);


loadProjects();
```

}

// ==========================================
// ERRORS
// ==========================================

function normalizeErrors(
errors
) {

```
if (!errors) {
    return [];
}

if (Array.isArray(errors)) {
    return errors;
}

if (typeof errors === "object") {
    return Object.values(errors);
}

return [
    String(errors)
];
```

}

// ==========================================
// MESSAGE
// ==========================================

function addMessage(
text,
type
) {

```
const wrapper =
    document.createElement("div");

wrapper.className =
    `message ${type}`;


const content =
    document.createElement("div");

content.className =
    "message-content";


content.textContent =
    text;


wrapper.appendChild(
    content
);

messages.appendChild(
    wrapper
);


messages.scrollTop =
    messages.scrollHeight;
```

}

// ==========================================
// NEW CHAT
// ==========================================

function newChat() {

```
messages.innerHTML = "";

welcome.classList.remove(
    "hidden"
);

buildPanel.classList.add(
    "hidden"
);

promptInput.value = "";

promptInput.style.height =
    "auto";

currentProject =
    "vov_project";

completedFiles.clear();

showPage(
    "chat"
);

promptInput.focus();
```

}

newChatBtn.addEventListener(
"click",
newChat
);

projectsNewBtn.addEventListener(
"click",
newChat
);

// ==========================================
// NAVIGATION
// ==========================================

function setupNavigation() {

```
document
    .getElementById("chatNav")
    .addEventListener(
        "click",
        () => showPage("chat")
    );


document
    .getElementById("projectsNav")
    .addEventListener(
        "click",
        () => showPage("projects")
    );


document
    .getElementById("activityNav")
    .addEventListener(
        "click",
        () => showPage("activity")
    );
```

}

function showPage(
page
) {

```
chatPage.classList.add(
    "hidden"
);

projectsPage.classList.add(
    "hidden"
);

activityPage.classList.add(
    "hidden"
);


document
    .querySelectorAll(
        ".nav-item"
    )
    .forEach(
        item => item.classList.remove(
            "active"
        )
    );


if (page === "chat") {

    chatPage.classList.remove(
        "hidden"
    );

    document
        .getElementById("chatNav")
        .classList.add(
            "active"
        );

}


if (page === "projects") {

    projectsPage.classList.remove(
        "hidden"
    );

    document
        .getElementById("projectsNav")
        .classList.add(
            "active"
        );

    loadProjects();

}


if (page === "activity") {

    activityPage.classList.remove(
        "hidden"
    );

    document
        .getElementById("activityNav")
        .classList.add(
            "active"
        );

    renderActivityHistory();

}


sidebar.classList.remove(
    "open"
);
```

}

// ==========================================
// RECENT PROJECT
// ==========================================

function addRecentProject(
name
) {

```
let projects =
    getStoredProjects();


projects =
    projects.filter(
        item => item !== name
    );


projects.unshift(
    name
);


projects =
    projects.slice(
        0,
        12
    );


localStorage.setItem(
    "vov_projects",
    JSON.stringify(projects)
);


renderRecentProjects();
```

}

function getStoredProjects() {

```
try {

    return JSON.parse(
        localStorage.getItem(
            "vov_projects"
        )
    ) || [];

}

catch {

    return [];

}
```

}

function renderRecentProjects() {

```
const projects =
    getStoredProjects();


recentList.innerHTML = "";


if (!projects.length) {

    recentList.innerHTML = `
        <div class="empty-recent">
            No recent projects
        </div>
    `;

    return;

}


projects.forEach(
    project => {

        const button =
            document.createElement("button");

        button.className =
            "recent-item";

        button.textContent =
            project;

        button.addEventListener(
            "click",
            () => {

                currentProject =
                    project;

                showPage(
                    "chat"
                );

            }
        );

        recentList.appendChild(
            button
        );

    }
);
```

}

// ==========================================
// PROJECTS
// ==========================================

function loadProjects() {

```
const projects =
    getStoredProjects();


renderRecentProjects();


if (!projects.length) {

    projectGrid.innerHTML = `

        <div class="project-empty">

            <div>✦</div>

            <h3>
                No projects yet
            </h3>

            <p>
                Ask VOV AI to build your first project.
            </p>

        </div>

    `;

    return;

}


projectGrid.innerHTML = "";


projects.forEach(
    project => {

        const card =
            document.createElement("div");

        card.className =
            "project-card";

        card.innerHTML = `

            <div class="project-card-icon">
                ◈
            </div>

            <h3>
                ${escapeHtml(project)}
            </h3>

            <p>
                VOV AI generated project
            </p>

            <div class="project-card-actions">

                <button
                    data-action="chat"
                >
                    Open
                </button>

                <button
                    data-action="test"
                >
                    Test
                </button>

            </div>

        `;


        card
            .querySelector(
                '[data-action="chat"]'
            )
            .addEventListener(
                "click",
                () => {

                    currentProject =
                        project;

                    showPage(
                        "chat"
                    );

                }
            );


        card
            .querySelector(
                '[data-action="test"]'
            )
            .addEventListener(
                "click",
                () => {

                    testProject(
                        project
                    );

                }
            );


        projectGrid.appendChild(
            card
        );

    }
);
```

}

// ==========================================
// TEST PROJECT
// ==========================================

async function testProject(
project
) {

```
try {

    const response =
        await fetch(
            `${API_URL}/test/${encodeURIComponent(project)}`,
            {
                method: "POST"
            }
        );


    const data =
        await response.json();


    if (data.working) {

        addMessage(
            `✅ ${project} passed the backend project test.`,
            "ai"
        );

    }

    else {

        const errors =
            normalizeErrors(
                data.errors
            );

        addMessage(
            `⚠️ ${project} has ${errors.length} detected issue(s).`,
            "ai"
        );

    }

    showPage(
        "chat"
    );

}

catch (error) {

    addMessage(
        "❌ Could not test the project.",
        "ai"
    );

}
```

}

// ==========================================
// ACTIVITY HISTORY
// ==========================================

function addActivityHistory(
message,
file,
status
) {

```
activityHistory.push({

    message:
        message || "Working",

    file:
        file || "",

    status:
        status || "working",

    time:
        new Date()

});


if (
    activityHistory.length > 100
) {

    activityHistory.shift();

}
```

}

function renderActivityHistory() {

```
activityHistoryElement.innerHTML = "";


if (!activityHistory.length) {

    activityHistoryElement.innerHTML = `

        <div class="history-empty">
            No build activity yet.
        </div>

    `;

    return;

}


activityHistory
    .slice()
    .reverse()
    .forEach(
        item => {

            const element =
                document.createElement("div");

            element.className =
                "history-item";

            element.innerHTML = `

                <div class="history-item-top">

                    <strong>
                        ${escapeHtml(item.message)}
                    </strong>

                    <span>
                        ${item.time.toLocaleTimeString()}
                    </span>

                </div>

                <span>
                    ${
                        item.file
                        ? "File: " +
                          escapeHtml(item.file)
                        : formatStatus(
                            item.status
                          )
                    }
                </span>

            `;

            activityHistoryElement
                .appendChild(
                    element
                );

        }
    );
```

}

// ==========================================
// CLOSE BUILD
// ==========================================

document
.getElementById("closeBuildBtn")
.addEventListener(
"click",
() => {

```
        buildPanel.classList.add(
            "hidden"
        );

    }
);
```

// ==========================================
// SETTINGS
// ==========================================

document
.getElementById("settingsBtn")
.addEventListener(
"click",
() => {

```
        settingsModal.classList.remove(
            "hidden"
        );

    }
);
```

document
.getElementById("closeSettingsBtn")
.addEventListener(
"click",
() => {

```
        settingsModal.classList.add(
            "hidden"
        );

    }
);
```

// ==========================================
// PREVIEW
// ==========================================

function openPreview(
projectName,
html
) {

```
previewTitle.textContent =
    projectName;

previewStatus.textContent =
    "Generated";


const blob =
    new Blob(
        [html],
        {
            type: "text/html"
        }
    );


const url =
    URL.createObjectURL(
        blob
    );


previewFrame.src =
    url;


previewModal.classList.remove(
    "hidden"
);
```

}

document
.getElementById("closePreviewBtn")
.addEventListener(
"click",
closePreview
);

function closePreview() {

```
previewModal.classList.add(
    "hidden"
);

previewFrame.src =
    "about:blank";
```

}

// ==========================================
// MODAL OVERLAYS
// ==========================================

document
.querySelectorAll(
".modal-overlay"
)
.forEach(
overlay => {

```
        overlay.addEventListener(
            "click",
            () => {

                overlay
                    .parentElement
                    .classList.add(
                        "hidden"
                    );

            }
        );

    }
);
```

// ==========================================
// PROJECT NAME
// ==========================================

function createProjectName(
prompt
) {

```
const words =
    prompt
        .toLowerCase()
        .replace(
            /[^a-z0-9\s]/g,
            ""
        )
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3);


let name =
    words.join("_");


if (!name) {

    name =
        "vov_project";

}


name =
    name.substring(
        0,
        35
    );


return name;
```

}

// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(
value
) {

```
const div =
    document.createElement(
        "div"
    );

div.textContent =
    String(value);

return div.innerHTML;
```

}

// ==========================================
// CSS ESCAPE
// ==========================================

function cssEscape(
value
) {

```
if (
    window.CSS &&
    typeof window.CSS.escape ===
    "function"
) {

    return window.CSS.escape(
        value
    );

}

return String(value)
    .replace(
        /"/g,
        '\\"'
    );
```

}

// ==========================================
// SLEEP
// ==========================================

function sleep(
milliseconds
) {

```
return new Promise(
    resolve =>
        setTimeout(
            resolve,
            milliseconds
        )
);
```

}

// ==========================================
// VOICE BUTTON
// ==========================================

document
.getElementById("voiceBtn")
.addEventListener(
"click",
() => {

```
        if (
            !(
                "webkitSpeechRecognition"
                in window
            )
        ) {

            addMessage(
                "🎤 Voice input isn't supported by this browser.",
                "ai"
            );

            return;

        }


        const recognition =
            new webkitSpeechRecognition();

        recognition.lang =
            "en-US";

        recognition.continuous =
            false;

        recognition.interimResults =
            false;


        recognition.onstart =
            () => {

                connectionText.textContent =
                    "Listening...";

            };


        recognition.onresult =
            event => {

                const text =
                    event
                        .results[0][0]
                        .transcript;

                promptInput.value =
                    text;

                autoResize();

                promptInput.focus();

                setConnection(
                    "online",
                    "Online"
                );

            };


        recognition.onerror =
            () => {

                setConnection(
                    "online",
                    "Online"
                );

            };


        recognition.onend =
            () => {

                checkBackend();

            };


        recognition.start();

    }
);
```

// ==========================================
// INITIAL RECENT PROJECTS
// ==========================================

renderRecentProjects();
