# TCPIOneer Guide

## Introduction
Welcome to _TCPIOneer_, an API that can serve as a **remote-desktop host** controlled via **HTTP endpoints**.

In this document is a guide on:

* Guide directory
* Authentication
* Session lifecycle
* Commands
* Capabilities
* Endpoints

This document should be able to guide you through operating TCPIOneer, whether you're a human, LLM, or anything with HTTP.

## Guide Directory

This is the main guide file. For extra information on endpoints or concepts, refer to this directory for locations.

Every link in this multi-level list does **not** need authentication to access.

* [Guide](/guide)
* * Endpoints
* * * [Request Session (/request-session)](/guide/endpoints/request-session)
* * Capabilities

## Authentication
Authentication in TCPIOneer is essential when you need to access endpoints related to remote desktop.

### Getting a Token
A token must be given to you by a server operator. Without an auth token, you **cannot** access the remote desktop endpoints.

If you have a token, using it is simple. To use a token, place it in the `Authorization` header as a `Bearer` token.

Example:
```
GET /api/v1/request-session HTTP/1.1
[other headers...]
Authorization: Bearer abcd1234
```

A valid token authenticates the request, but does not by itself guarantee
that the requested operation will be accepted. Session state, capabilities,
and server policy may also affect whether a request is permitted.

> **IMPORTANT:** If a server operator needs to rotate a token, it's best to do so through TCPIOneer's CLI options rather than editing `config.json` manually, since cryptographic random generation is built into TCPIOneer.

## Session Lifecycle
Sessions are the **authorization context** used to access the remote desktop, and **without them, you cannot use the remote desktop**. 

One client is not bound to one session; **a client may have multiple sessions**.

This can also go the other way. **Sessions can be utilized by more than one client** if they possess the **session key** for the session.

> Sharing a session key with multiple clients is **not recommended** unless all clients are coordinated, because all clients with the key share access to the session.

Sessions are built to **only live for as long as they are used**.
Sessions **must** be removed if unused, since servers often have a maximum session limit. (see [Session Deletion](#session-deletion))

Here's a graph showing you what this lifecycle looks like (left to right):

```
graph LR
a["Session Request"]
b{"Permitted?"}
c(["End"])
d["Session Creation"]
e["Session Usage"]
f["Session Deletion"]

a --> b
b -- "No" --> c
b -- "Yes" --> d
d --> e
e --> e
e -- End of usage --> f
f --> c
```

### Session Requesting

When you request for a session in TCPIOneer, the server ensures that you are able to create a new session. The server would give you a session key if the server allows the session to be created.

If the server prohibits you from creating a session, it will return an HTTP error in the response depending on what went wrong (see [Request Session (/request-session)](/guide/endpoints/request-session)).

#### Session Key

A session key is a UUID that is randomly generated for your session. This key is used to select your session and to verify you are authorized to use it.

A session key identifies and authorizes access to a session; it does not authenticate the client as the original session creator.

### Session Usage

To use a session key, place it in the `Session` key of JSON POST endpoints.

Example:
```json
{
    "data": {
        // ...
    },
    "session": "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx" // (your session key)
}
```

### Session Deletion

When a session is deleted, **it CAN NOT be used anymore**.
A session **MUST** be deleted when:

* It does not need to be used anymore
* The client times out
* The server needs the session to be deleted

A session may be deleted by the server or the client, though the difference is that the client can only **request** the server to delete the session; the server can **force** the deletion of a session at any time, since the server hosts the session. Though, it is the server's responsibility to inform the client about a session deletion when a client requests for it.

The client will discover a session deletion on the next attempt to use it and **must** stop attempts to use the session key.

## Capabilities

Capabilities in TCPIOneer define which operations clients can do on a host.
Capabilities are defined in the server's `capabilities.json`. Capabilities include:

* Mouse control
* Keypress and type control
* On-demand screenshot access
* Terminal access

The client **CANNOT** execute operations that are not permitted by the file.

More specific information can be found at [Capabilities](/guide/capabilities).

## Endpoints

> Specific endpoint help can be found as children in Endpoints (see [Guide Directory](#guide-directory)).
> This section is for general endpoint info.

Endpoints are the ways to access the TCPIOneer API, and any other HTTP API you will ever look at.

### Common Issues

If you're having issues with endpoints, try checking the following:

* You are using the proper authentication to use the endpoint
* Your request is not malformed
* The reason of the error (might include more information on the error)

Make sure to check these before sending a bug report.

## License Information

Copyright 2026 Byte-ByByte

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.