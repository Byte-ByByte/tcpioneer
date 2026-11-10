// API types

<<<<<<< HEAD
import { CapabilityPermission } from "../../capabilities"

=======
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
export type SessionObject = {
    "session": `${string}-${string}-${string}-${string}-${string}` // UUID
    "created": string
    "expiry": string
<<<<<<< HEAD
    "capabilities": {
        capability: string,
        tasks: number[]
    }[]
=======
    "capabilities": string[]
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
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