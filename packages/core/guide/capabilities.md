# Desktop Control API

TCPIOneer exposes authenticated HTTP endpoints for basic interactive desktop control on Windows. The host must be running in the logged-in user's interactive desktop session; a Windows service or headless session cannot interact with the visible desktop.

## Authentication and sessions

Every request needs `Authorization: Bearer <token>`. Create a one-hour session first:

```http
POST /api/v1/request-session
Authorization: Bearer <token>
```

The response contains a UUID in `session`; pass it in the JSON body for control and screenshot requests. Sessions are stored in memory and expire when the server restarts or after one hour.

## Mouse and keyboard

Send a control action with:

```http
POST /api/v1/control
Authorization: Bearer <token>
Content-Type: application/json

{"session":"<session UUID>","action":{"action":"mouse.move","x":800,"y":450}}
```

Supported actions:

```json
{"session":"<session UUID>","action":{"action":"mouse.move","x":800,"y":450}}
{"session":"<session UUID>","action":{"action":"mouse.click","button":"left"}}
{"session":"<session UUID>","action":{"action":"mouse.drag","fromX":100,"fromY":100,"toX":300,"toY":250,"button":"left"}}
{"session":"<session UUID>","action":{"action":"mouse.scroll","amount":120}}
{"session":"<session UUID>","action":{"action":"keyboard.press","keys":["CTRL","S"]}}
{"session":"<session UUID>","action":{"action":"keyboard.type","text":"Hello"}}
```

Mouse coordinates are screen pixels. Scroll amount is between -1200 and 1200. Key names include A-Z, 0-9, F1-F12, CTRL, ALT, SHIFT, WIN, ENTER, TAB, ESC, SPACE, BACKSPACE, DELETE, INSERT, HOME, END, PAGEUP, PAGEDOWN, and the arrow keys. Text input is limited to 2,000 characters per request.

## Screenshot

Request a JPEG of the virtual desktop:

```http
POST /api/v1/screenshot
Authorization: Bearer <token>
Content-Type: application/json

{"session":"<session UUID>"}
```

The response body is `image/jpeg`.

## Security

These endpoints can control the logged-in desktop and expose its screen. Keep the default bind address on `127.0.0.1` unless remote access is deliberately configured. Change the example token in `packages/cli/config.json` before enabling network access, and use a trusted VPN or TLS-terminating proxy; bearer tokens sent over plain HTTP can be intercepted. Do not expose this host directly to the public internet.

Arbitrary shell execution is not provided by this API.