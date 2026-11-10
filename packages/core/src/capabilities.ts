
export enum Capability {
    keyboard
};

<<<<<<< HEAD
export type CapabilityPermission = {
    capability: Capability,
    tasks: number[]
}

export type CapabilityConfigEntry = {
    capability: string,
    tasks: number[]
}

=======
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
export const nameToCapability: Map<string, Capability> = new Map<string, Capability>([
    ["keyboard", Capability.keyboard]
]);

export const capabilityToName: Map<Capability, string> = new Map<Capability, string>([
    [Capability.keyboard, "keyboard"]
]);

<<<<<<< HEAD
export function entriesToCapabilityPermissions(entries: CapabilityConfigEntry[]): CapabilityPermission[] {
    let permissions: CapabilityPermission[] = []

    for (const entry of entries) {
        const capability = nameToCapability.get(entry.capability);

        if (capability) {
            permissions.push({
                capability: capability,
                tasks: entry.tasks
            });
        }

        return permissions;
    }

    return permissions;
=======
export function namesToCapabilities(names: string[]): Capability[] {
    let capabilities: Capability[] = []

    for (const name of names) {
        const capability = nameToCapability.get(name);

        if (capability) capabilities.push(capability);
    }

    return capabilities;
>>>>>>> parent of 2200512 (Replace main contents with GPT-IO rebuild)
}

export function capabilitiesToNames(capabilities: Capability[]): string[] {
    let names: string[] = []

    for (const capability of capabilities) {
        const name = capabilityToName.get(capability);

        if (name) names.push(name);
    }

    return names;
}