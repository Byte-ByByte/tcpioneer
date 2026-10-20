import endpointCors from "./api/cors"
import endpointPages from "./api/pages"
import endpointAi from "./api/ai"
import endpointApiIndex from "./api/index"
import v1Endpoints from "./api/v1"
import endpointGuide from "./api/guide"
import endpointHelloWorld from "./api/helloworld"

const globalEndpointArray = [
    endpointCors,
    endpointPages,
    endpointAi,
    endpointApiIndex,
    ...v1Endpoints,
    endpointGuide,
    endpointHelloWorld
]

export default globalEndpointArray
