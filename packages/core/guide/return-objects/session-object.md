# Session Object

## Introduction

The session object is what [Request Session (/request-session)](/guide/endpoints/request-session) sends as a **member** of its *response body* when the response status code is 201 Created.

In this document is a:

* Typing of the session object
* Description of each property
* Example of a loaded session object

## Typing

Attributes for the session object are listed as:

* `session-key`: UUID, used to access a session (see [Guide: Session Key](/guide#session-key))
* `created`: UTC string (ISO 8601) describing when the session was made
* `expiry`: UTC string (ISO 8601) describing **when the session will expire** and be deleted
* `capabilities`: List of capabilities **permitted** to be used this session (see [Capabilities](/guide/capabilities))
* `timeout`: How many seconds the session can be **unused** before the server deletes the session
* `usable`: If the session can be used **right now**.
* `unusable-until`: `undefined` if `usable` is `true`, If `usable` is `false`, `unusable-until` is a UTC string (ISO 8601) that describes **when the session can be used**.

## Examples

### Fully loaded example

Below is an example session object that is fully filled out.

```json
{
    "session-key": "c8d3ed48-2581-482b-961e-d58a02bced45",
    "created": "2026-10-02T01:09:37.557Z",
    "expiry": "2026-10-03T01:09:37.557Z",
    "capabilities": [
        "keyboard",
        "mouse",
        "terminal",
        "screenshot"
    ],
    "timeout": 120,
    "usable": false,
    "unusable-until": "2026-02-01T10:25:37.000Z"
}
```

### TypeScript typing

Below is a fully compatible TypeScript type that can be dropped into code without modification.

```typescript
type SessionObject = {
    "session-id": `${string}-${string}-${string}-${string}-${string}` // UUID
    "created": string
    "expiry": string
    "capabilities": string[]
    "timeout": number
    "usable": boolean
    "unusable-until"?: string
}
```