export enum Capability {
    keyboard
}

export type CapabilityPermission = {
    capability: Capability,
    tasks: number[]
}

export type CapabilityConfigEntry = {
    capability: string,
    tasks: number[]
}

export const nameToCapability: Map<string, Capability> = new Map<string, Capability>([
    ["keyboard", Capability.keyboard]
]);

export const capabilityToName: Map<Capability, string> = new Map<Capability, string>([
    [Capability.keyboard, "keyboard"]
]);

export function entriesToCapabilityPermissions(entries: CapabilityConfigEntry[]): CapabilityPermission[] {
    const permissions: CapabilityPermission[] = [];

    for (const entry of entries) {
        const capability = nameToCapability.get(entry.capability);

        if (capability) {
            permissions.push({
                capability,
                tasks: entry.tasks
            });
        }
    }

    return permissions;
}

export function namesToCapabilities(names: string[]): Capability[] {
    const capabilities: Capability[] = [];

    for (const name of names) {
        const capability = nameToCapability.get(name);

        if (capability) capabilities.push(capability);
    }

    return capabilities;
}

export function capabilitiesToNames(capabilities: Capability[]): string[] {
    const names: string[] = [];

    for (const capability of capabilities) {
        const name = capabilityToName.get(capability);

        if (name) names.push(name);
    }

    return names;
}