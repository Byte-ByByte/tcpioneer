import { Logger } from "./logger"

type HostConfig = {
    logger: Logger
    server: {
        host: string
        port: number
        token: string
        lockedUntil: Date | null
        session: {
            timeout: number
            capabilities: string[]
            expiryOffset: {
                days: number
                hours: number
                minutes: number
                seconds: number
            }
        },
        guide: {
            location: string
        }
    }
}

export default HostConfig