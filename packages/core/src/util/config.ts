import { Logger } from "./logger"

type HostConfig = {
    logger: Logger
    server: {
        host: string,
        port: number,
        token: string,
        tls?: { cert: string; key: string },
        guide: {
            location: string
        }
    }
}

export default HostConfig