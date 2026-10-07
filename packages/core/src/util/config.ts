import { Logger } from "./logger"

type HostConfig = {
    logger: Logger
    server: {
        host: string,
        port: number,
        token: string,
        guide: {
            location: string
        }
    }
}

export default HostConfig