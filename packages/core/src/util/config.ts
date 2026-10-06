import { Logger } from "./logger"

type HostConfig = {
    logger: Logger
    server: {
        host: string,
        port: number,
        token: string
    }
}

export default HostConfig