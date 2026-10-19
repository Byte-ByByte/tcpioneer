// Pack /api into an enpoint array

import endpointHelloWorld from "./api/helloworld"
import endpointGuide from "./api/guide"

const globalEndpointArray = [endpointGuide, endpointHelloWorld]

export default globalEndpointArray