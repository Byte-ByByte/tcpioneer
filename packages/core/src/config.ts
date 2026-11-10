import { CapabilityPermission } from "./capabilities"
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
<<<<<<< HEAD
            capabilities: CapabilityPermission[]
=======
            capabilities: string[]
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
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