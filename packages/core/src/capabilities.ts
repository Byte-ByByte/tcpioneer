
export enum Capability {
    keyboard
};

export const nameToCapability: Map<string, Capability> = new Map<string, Capability>([
    ["keyboard", Capability.keyboard]
]);

export const capabilityToName: Map<Capability, string> = new Map<Capability, string>([
    [Capability.keyboard, "keyboard"]
]);

export function namesToCapabilities(names: string[]): Capability[] {
    let capabilities: Capability[] = []

    for (const name of names) {
        const capability = nameToCapability.get(name);

        if (capability) capabilities.push(capability);
    }

    return capabilities;
}

export function capabilitiesToNames(capabilities: Capability[]): string[] {
    let names: string[] = []

    for (const capability of capabilities) {
        const name = capabilityToName.get(capability);

        if (name) names.push(name);
    }

    return names;
}