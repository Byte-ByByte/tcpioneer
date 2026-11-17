// Pack /api into an enpoint array

import endpointHelloWorld from "./api/helloworld"
import endpointGuide from "./api/guide"
import endpointRequestSession from "./api/request-session"
import endpointCapability from "./api/capability";
import { endpointDeleteSession } from "./api/delete-session";

const globalEndpointArray = [endpointGuide, endpointHelloWorld, endpointRequestSession, endpointCapability, endpointDeleteSession];

export default globalEndpointArray