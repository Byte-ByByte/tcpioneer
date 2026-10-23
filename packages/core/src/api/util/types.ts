// API types

export type SessionObject = {
    "session": `${string}-${string}-${string}-${string}-${string}` // UUID
    "created": string
    "expiry": string
    "capabilities": string[]
    "timeout": number
    "usable": boolean
    "unusable-until"?: string
}

export type ErrorObject = {
    "code": string
    "message": string
    "source": "server" | "client"
    "extra-info": {}
}

export enum Origin {
    server,
    client
}