export const homePage = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101827">
  <title>TCPIOneer</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #101827; color: #e6edf7; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    main { width: min(760px, 100%); }
    h1 { margin: 0 0 8px; font-size: clamp(2rem, 6vw, 3.5rem); letter-spacing: -.04em; }
    .intro { margin: 0 0 32px; color: #9eacc2; font-size: 1.1rem; }
    .choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; }
    a.card, section.card { display: block; min-height: 190px; padding: 24px; border: 1px solid #2c3b50; border-radius: 16px; background: #172337; color: inherit; text-decoration: none; transition: border-color .15s, transform .15s; }
    a.card:hover, a.card:focus-visible, section.card:hover { border-color: #70a7ff; transform: translateY(-2px); outline: none; }
    section.card a { color: #a9caff; }
    .ai-link { display: block; margin-top: 18px; color: #a9caff; }
    .icon { display: block; margin-bottom: 18px; font-size: 1.8rem; }
    h2 { margin: 0 0 8px; font-size: 1.25rem; }
    .card p { margin: 0; color: #9eacc2; line-height: 1.55; }
    footer { margin-top: 24px; color: #73839a; font-size: .9rem; }
  </style>
</head>
<body>
  <main>
    <h1>TCPIOneer</h1>
    <p class="intro">What would you like to do?</p>
    <nav class="choices" aria-label="Choose an option">
      <a class="card" href="/desktop">
        <span class="icon" aria-hidden="true">&#128421;</span>
        <h2>Remote desktop</h2>
        <p>Connect to a PC by entering its server URL and access token.</p>
      </a>
      <section class="card">
        <span class="icon" aria-hidden="true">&#128214;</span>
        <h2>Open the guide</h2>
        <p><a href="https://github.com/Byte-ByByte/tcpioneer-guide/blob/e5563ef59509f3d37180ea3164c2a81bd0d3017e/index.md" target="_blank" rel="noopener noreferrer">Read the formatted guide on GitHub</a></p>
        <p><a href="https://github.com/Byte-ByByte/tcpioneer-guide/raw/c27697b6a7f9f697c2aac490cca6d090afefde4a/index.md" target="_blank" rel="noopener noreferrer">Download the Markdown file</a></p>
      </section>
    </nav>
    <footer>Choose Remote desktop to connect to this PC or another TCPIOneer host.<a class="ai-link" href="/ai">AI/API connection information: /ai</a></footer>
  </main>
</body>
</html>`;

export const desktopPage = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101827">
  <title>Remote desktop - TCPIOneer</title>
  <style>
    :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #101827; color: #e6edf7; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; }
    header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px clamp(16px, 4vw, 40px); border-bottom: 1px solid #27364a; }
    header a { color: #a9caff; text-decoration: none; }
    header a:hover { text-decoration: underline; }
    h1 { margin: 0; font-size: 1.1rem; }
    main { width: min(960px, 100%); margin: 44px auto; padding: 0 20px; }
    h2 { margin: 0 0 8px; font-size: 1.8rem; }
    .lead, .hint { color: #9eacc2; line-height: 1.55; }
    form { display: grid; gap: 16px; max-width: 620px; margin-top: 24px; }
    label { display: grid; gap: 7px; font-weight: 600; }
    input { width: 100%; padding: 12px 14px; border: 1px solid #3a4b63; border-radius: 8px; background: #121c2b; color: #e6edf7; font: inherit; }
    input:focus { border-color: #70a7ff; outline: 2px solid #70a7ff44; }
    button { width: fit-content; border: 0; border-radius: 8px; padding: 11px 17px; background: #3679e5; color: white; font: inherit; font-weight: 700; cursor: pointer; }
    button:hover { background: #4b8af0; }
    button:disabled { opacity: .55; cursor: wait; }
    #status { min-height: 1.5em; margin: 16px 0; color: #a9caff; }
    #status.error { color: #ff9c9c; }
    #desktop { margin-top: 26px; }
    .toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 12px; }
    .toolbar button { background: #304159; }
    .toolbar button:hover { background: #405674; }
    #screen { display: block; max-width: 100%; max-height: 72vh; margin: 0 auto; border: 1px solid #45566e; border-radius: 6px; background: #080d14; object-fit: contain; touch-action: none; user-select: none; }
    #screen:focus { outline: 2px solid #70a7ff; }
    .screen-wrap { padding: 12px; border: 1px solid #27364a; border-radius: 12px; background: #0c1420; }
    #screen-wrap:fullscreen { display: grid; width: 100vw; height: 100vh; place-items: center; padding: 12px; border: 0; border-radius: 0; background: #080d14; }
    #screen-wrap:fullscreen #screen { max-width: 100vw; max-height: calc(100vh - 24px); border: 0; }
    .hint { font-size: .9rem; }
    [hidden] { display: none !important; }
<<<<<<< HEAD
`;

export const homePage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101827">
  <title>TCPIOneer</title>
  <style>${styles}</style>
</head>
<body>
  <div class="hero">
    <main>
      <h1>TCPIOneer</h1>
      <p class="intro">Connect to this PC from a browser, or use the HTTP API.</p>
      <nav class="choices" aria-label="Choose an option">
        <a class="card" href="/desktop">
          <span class="icon" aria-hidden="true">&#128421;</span>
          <h2>Remote desktop</h2>
          <p>Open a live view of this PC. The Authorization header is verified automatically.</p>
        </a>
        <a class="card" href="https://github.com/Byte-ByByte/tcpioneer-guide/blob/e5563ef59509f3d37180ea3164c2a81bd0d3017e/index.md" target="_blank" rel="noopener noreferrer">
          <span class="icon" aria-hidden="true">&#128214;</span>
          <h2>Open the guide</h2>
          <p>Read the TCPIOneer documentation on GitHub.</p>
        </a>
      </nav>
      <footer>AIs: GET /ai with an Authorization bearer header, or GET /api for the HTTP API.</footer>
    </main>
  </div>
</body>
</html>`;

export function desktopPage(token: string, autoConnect = false): string {
    const bearerToken = JSON.stringify(token);
    const shouldAutoConnect = autoConnect ? "true" : "false";
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#101827">
  <title>Remote desktop - TCPIOneer</title>
  <style>${styles}</style>
=======
  </style>
>>>>>>> parent of 4b57c7b (d)
</head>
<body>
  <header>
    <h1>TCPIOneer</h1>
    <a href="/">Home</a>
  </header>
  <main>
    <section id="connect">
      <h2>Connect to a PC</h2>
      <p class="lead">Enter the TCPIOneer server URL and its access token. The token is sent in the Authorization bearer header and is kept only in this page while connected.</p>
      <form id="connect-form">
        <label for="server-url">PC server URL</label>
        <input id="server-url" name="server-url" type="url" placeholder="http://192.168.1.25:3420" required autocomplete="url">
        <label for="token">Access token</label>
        <input id="token" name="token" type="password" required autocomplete="off">
        <button id="connect-button" type="submit">Connect</button>
      </form>
      <p class="hint">Use the host's configured server URL and token. The PC must be reachable from this browser.</p>
    </section>
    <p id="status" role="status" aria-live="polite"></p>
    <section id="desktop" hidden>
      <div class="toolbar">
        <strong>Remote PC</strong>
        <button id="refresh-button" type="button">Refresh screen</button>
        <button id="fullscreen-button" type="button">Enter fullscreen</button>
        <button id="disconnect-button" type="button">Disconnect</button>
      </div>
      <div id="screen-wrap" class="screen-wrap">
        <img id="screen" alt="Remote PC screen. Click here to send mouse and keyboard input." tabindex="0" draggable="false">
      </div>
      <p class="hint">Click or drag on the screen to control the mouse. Focus the screen and use your keyboard to send key presses.</p>
    </section>
  </main>
  <script>
    const form = document.getElementById("connect-form");
    const connectSection = document.getElementById("connect");
    const connectButton = document.getElementById("connect-button");
    const statusText = document.getElementById("status");
    const desktopSection = document.getElementById("desktop");
    const screen = document.getElementById("screen");
    const screenWrap = document.getElementById("screen-wrap");
    const fullscreenButton = document.getElementById("fullscreen-button");
    const serverUrlInput = document.getElementById("server-url");
    serverUrlInput.value = window.location.origin;

    let serverUrl = "";
    let bearerToken = "";
    let activeSession = "";
    let refreshTimer = 0;
    let screenshotObjectUrl = "";

    function setStatus(message, isError) {
      statusText.textContent = message;
      statusText.classList.toggle("error", Boolean(isError));
    }

    async function requestJson(path, method, payload) {
      const headers = { "Authorization": "Bearer " + bearerToken };
      const options = { method: method, headers: headers };
      if (payload !== undefined) {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
      }
      let response;
      try {
        response = await fetch(serverUrl + path, options);
      } catch (_) {
        throw new Error("Could not reach the PC. Check the URL and network connection.");
      }
      let data;
      try {
        data = await response.json();
      } catch (_) {
        throw new Error("The PC returned an invalid response (HTTP " + response.status + ").");
      }
      if (!response.ok) {
        throw new Error(data && typeof data.error === "string" ? data.error : "Request failed (HTTP " + response.status + ").");
      }
      return data;
    }

    function normalizeServerUrl(value) {
      let parsed;
      try {
        parsed = new URL(value);
      } catch (_) {
        throw new Error("Enter a valid PC server URL, including http:// or https://.");
      }
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("The PC URL must use http:// or https://.");
      }
      if (parsed.username || parsed.password || (parsed.pathname !== "/" && parsed.pathname !== "")) {
        throw new Error("Enter the server origin only, such as http://192.168.1.25:3420.");
      }
      return parsed.origin;
    }

    async function connect(event) {
      event.preventDefault();
      connectButton.disabled = true;
      setStatus("Checking the PC and verifying the Authorization header...", false);
      serverUrl = "";
      bearerToken = "";
      activeSession = "";
      try {
        serverUrl = normalizeServerUrl(serverUrlInput.value.trim());
        bearerToken = document.getElementById("token").value;
        document.getElementById("token").value = "";
        if (!bearerToken) throw new Error("Enter the PC access token.");

        const created = await requestJson("/api/v1/request-session", "POST", {});
        if (!created || typeof created.session !== "string" || !created.session) {
          throw new Error("The PC did not return a valid session.");
        }
        activeSession = created.session;

        const verified = await requestJson("/api/v1/session?session=" + encodeURIComponent(activeSession), "GET");
        if (!verified || verified.valid !== true || verified.session !== activeSession) {
          throw new Error("The PC did not verify the session with the Authorization header.");
        }

        connectSection.hidden = true;
        desktopSection.hidden = false;
        setStatus("Connected. The Authorization bearer header and session were verified.", false);
        await refreshScreen();
      } catch (error) {
        let message = error instanceof Error ? error.message : "Connection failed.";
        if (activeSession && bearerToken) {
          try {
            await requestJson("/api/v1/session?session=" + encodeURIComponent(activeSession), "DELETE");
          } catch (cleanupError) {
            const cleanupMessage = cleanupError instanceof Error ? cleanupError.message : "unknown error";
            message += " The temporary session could not be closed: " + cleanupMessage;
          }
        }
        setStatus(message, true);
        activeSession = "";
        bearerToken = "";
        serverUrl = "";
      } finally {
        connectButton.disabled = false;
      }
    }

    async function refreshScreen() {
      if (!activeSession) return;
      try {
        const response = await fetch(serverUrl + "/api/v1/screenshot", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + bearerToken,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ session: activeSession })
        });
        if (!response.ok) {
          let data;
          try { data = await response.json(); } catch (_) { data = null; }
          throw new Error(data && typeof data.error === "string" ? data.error : "Screen capture failed (HTTP " + response.status + ").");
        }
        const nextUrl = URL.createObjectURL(await response.blob());
        const previousUrl = screenshotObjectUrl;
        screenshotObjectUrl = nextUrl;
        screen.src = nextUrl;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        setStatus("Connected. The Authorization bearer header and session were verified.", false);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not refresh the PC screen.", true);
      } finally {
        if (activeSession) refreshTimer = window.setTimeout(refreshScreen, 1000);
      }
    }

    async function sendAction(action) {
      if (!activeSession) return;
      try {
        await requestJson("/api/v1/control", "POST", { session: activeSession, action: action });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "The PC control request failed.", true);
      }
    }

    function screenPoint(event) {
      const bounds = screen.getBoundingClientRect();
      if (!screen.naturalWidth || !screen.naturalHeight || !bounds.width || !bounds.height) return null;
      return {
        x: Math.round((event.clientX - bounds.left) * screen.naturalWidth / bounds.width),
        y: Math.round((event.clientY - bounds.top) * screen.naturalHeight / bounds.height)
      };
    }

    let dragStart = null;
    let dragButton = "left";
    screen.addEventListener("pointerdown", function(event) {
      if (event.button < 0 || event.button > 2) return;
      dragStart = screenPoint(event);
      dragButton = event.button === 1 ? "middle" : event.button === 2 ? "right" : "left";
      screen.focus();
      screen.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    screen.addEventListener("pointerup", function(event) {
      if (!dragStart) return;
      const end = screenPoint(event);
      const start = dragStart;
      const button = dragButton;
      dragStart = null;
      if (!end || !start) return;
      if (Math.abs(end.x - start.x) > 4 || Math.abs(end.y - start.y) > 4) {
        sendAction({ action: "mouse.drag", fromX: start.x, fromY: start.y, toX: end.x, toY: end.y, button: button });
      } else {
        sendAction({ action: "mouse.click", button: button });
      }
      event.preventDefault();
    });
    screen.addEventListener("pointercancel", function() { dragStart = null; });
    screen.addEventListener("contextmenu", function(event) { event.preventDefault(); });

    function keyName(key) {
      const names = {
        " ": "SPACE", "ArrowLeft": "LEFT", "ArrowRight": "RIGHT",
        "ArrowUp": "UP", "ArrowDown": "DOWN", "Escape": "ESC",
        "Backspace": "BACKSPACE", "Tab": "TAB", "Enter": "ENTER",
        "Delete": "DELETE", "Home": "HOME", "End": "END",
        "PageUp": "PAGEUP", "PageDown": "PAGEDOWN",
        "Control": "CTRL", "Alt": "ALT", "Shift": "SHIFT", "Meta": "WIN"
      };
      if (names[key]) return names[key];
      if (/^F([1-9]|1[0-2])$/.test(key)) return key.toUpperCase();
      if (/^[a-z0-9]$/i.test(key)) return key.toUpperCase();
      return "";
    }

    screen.addEventListener("keydown", function(event) {
      if (!activeSession) return;
      if (event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        sendAction({ action: "keyboard.type", text: event.key });
        return;
      }
      const keys = [];
      if (event.ctrlKey) keys.push("CTRL");
      if (event.altKey) keys.push("ALT");
      if (event.shiftKey) keys.push("SHIFT");
      if (event.metaKey) keys.push("WIN");
      const key = keyName(event.key);
      if (key && keys.indexOf(key) === -1) keys.push(key);
      if (!keys.length || keys.length > 4) return;
      event.preventDefault();
      sendAction({ action: "keyboard.press", keys: keys });
    });

    async function disconnect() {
      window.clearTimeout(refreshTimer);
      if (activeSession) {
        try {
          await requestJson("/api/v1/session?session=" + encodeURIComponent(activeSession), "DELETE");
        } catch (error) {
          setStatus(error instanceof Error ? error.message : "Could not close the PC session.", true);
        }
      }
      activeSession = "";
      bearerToken = "";
      serverUrl = "";
      screen.removeAttribute("src");
      if (screenshotObjectUrl) URL.revokeObjectURL(screenshotObjectUrl);
      screenshotObjectUrl = "";
      desktopSection.hidden = true;
      connectSection.hidden = false;
      document.getElementById("token").value = "";
    }

    form.addEventListener("submit", connect);
    document.getElementById("refresh-button").addEventListener("click", function() {
      window.clearTimeout(refreshTimer);
      refreshScreen();
    });
    fullscreenButton.addEventListener("click", async function() {
      try {
        if (document.fullscreenElement === screenWrap) {
          await document.exitFullscreen();
        } else {
          await screenWrap.requestFullscreen();
        }
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not change fullscreen mode.", true);
      }
    });
    document.addEventListener("fullscreenchange", function() {
      fullscreenButton.textContent = document.fullscreenElement === screenWrap ? "Exit fullscreen" : "Enter fullscreen";
    });
    document.getElementById("disconnect-button").addEventListener("click", disconnect);
  </script>
</body>
</html>`;
