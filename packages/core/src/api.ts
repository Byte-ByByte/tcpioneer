// Pack /api into an enpoint array

import endpointHelloWorld from "./api/helloworld"
import endpointGuide from "./api/guide"
import endpointRequestSession from "./api/request-session"

const globalEndpointArray = [endpointGuide, endpointHelloWorld, endpointRequestSession];

export default globalEndpointArray