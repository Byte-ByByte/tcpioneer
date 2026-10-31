import { Origin } from "./api/util/types"
import { Capability, CapabilityPermission } from "./capabilities"

/** Represents a session and the capabilities granted to it. */
export class Session {
    /** The key used to identify this session. */
    readonly key: `${string}-${string}-${string}-${string}-${string}`

    /** The date until the session is usable, or `null` if unrestricted. */
    unusableUntil: Date | null

    /** Capabilities granted to this session. */
    private readonly permissions: readonly CapabilityPermission[]

    /** The date when this session was created. */
    readonly created: Date

    /** When the session will expire and become deleted. */
    readonly expiry: Date

    /** How many milliseconds this session can be unused before the server deletes the session. */
    readonly timeout: number

    /**
     * Creates a session.
     * @param capabilities Capabilities granted to the session.
     * @param expiry The date this session will expire at. 
     * @param [timeout=60000] How many milliseconds this session can be unused before the server deletes the session.
     * @param unusableUntil The date until the session is usable, or `null`.
     */
    constructor(permissions: readonly CapabilityPermission[], expiry: Date, timeout: number = 60000, unusableUntil: Date | null = null) {
        this.key = crypto.randomUUID();
        this.permissions = [...permissions];
        this.unusableUntil = unusableUntil;
        this.expiry = expiry;
        this.timeout = timeout;
        this.created = new Date();
    }

    /** Checks whether this session has the specified capability, or task in a capability. */
    canUse(capability: Capability, task: number | null = null): boolean {
        for (const permission of this.permissions) {
            if (permission.capability == capability && task ? permission.tasks.includes(task) : true) return true;
        }

        return false;
    }

    /** Returns whether this session is usable at the current time. */
    isUsable(): boolean {
        const now = Date.now();

        if (now >= this.expiry.getTime()) {
            return false;
        }

        if (this.unusableUntil !== null &&
            now < this.unusableUntil.getTime()) {
            return false;
        }

        return true;
    }
}

/** Provides metadata regarding the deletion of a session. */
export type SessionTombstone = {
    deletionOrigin: Origin;
    originalId: string;
    sessionCreation: Date;
    sessionDeletion: Date;
    reason: string;
}

/** Internal representation of a session timeout callback. */
type SessionTimeout = {
    timeout: NodeJS.Timeout,
    timerid: string;
}

/** Manages active sessions and temporary tombstones for deleted sessions. */
export class SessionManager {
    /** Sessions currently available for use. */
    private sessions: Map<string, Session> = new Map<string, Session>([]);

    /** Sessions retained temporarily after deletion. */
    private deletedSessions: Map<string, SessionTombstone> = new Map<string, SessionTombstone>();

    /** Timers that remove tombstones after their retention period. */
    private tombstoneCallbacks: Map<string, NodeJS.Timeout> = new Map<string, NodeJS.Timeout>();

    /** Timers that delete after their timeout period. */
    private sessionTimeoutCallbacks: Map<string, SessionTimeout> = new Map<string, SessionTimeout>();

    /** How long deleted sessions are retained as tombstones, in milliseconds. */
    tombstoneTimeout: number;

    /**
     * Creates a session manager.
     * @param timeout How long deleted sessions are retained as tombstones, in milliseconds.
     */
    constructor(timeout: number) {
        this.tombstoneTimeout = timeout;
    }

    private _createSessionTimeout(session: Session) {
        const timerid = crypto.randomUUID();
        
        const timeout: SessionTimeout = {
            timeout: setTimeout(this._createTimeoutCallback(session.key, timerid), session.timeout),
            timerid: timerid
        }

        this.sessionTimeoutCallbacks.set(session.key, timeout);
    }

    private _createTimeoutCallback(key: `${string}-${string}-${string}-${string}-${string}`, timerid: string): () => void {

        return () => {
            const timeout = this.sessionTimeoutCallbacks.get(key);

            if (!timeout || timeout.timerid != timerid) return;

            this.update();

            this.deleteSession(key, "timeout");
            this.sessionTimeoutCallbacks.delete(key);
        }
    }

    private _updatelessDeleteSession(key: `${string}-${string}-${string}-${string}-${string}`, reason: string, origin: Origin = Origin.server, useTombstone: boolean = true): Session | undefined {
        const session = this.sessions.get(key); // Get session before we delete it
        
        // Check if we have that session
        if (session) {
            // We do, start deletion

            // Remove the timeout
            const timeout = this.sessionTimeoutCallbacks.get(key);

            if (timeout) {
                clearTimeout(timeout.timeout);
                this.sessionTimeoutCallbacks.delete(key);
            }

            if (!useTombstone) {
                // Don't use the tombstone
                if (this.sessions.delete(key)) {
                    return session;
                } else {
                    // We didn't find a session; no session to give back to the user
                    return undefined;
                }
            }

            // Set up tombstone system

            // Remove the session from the session list
            this.sessions.delete(key);

            const tombstone = {
                deletionOrigin: origin,
                originalId: key,
                sessionCreation: session.created,
                sessionDeletion: new Date(),
                reason: reason
            };

            this.deletedSessions.set(key, tombstone); // Put it into the deleted sessions list

            this.tombstoneCallbacks.set(key, setTimeout(() => {
                this.deletedSessions.delete(key);
                this.tombstoneCallbacks.delete(key);
            }, this.tombstoneTimeout)) // Remove it after timeout
        } else {
            // We didn't find a session; no session to give back to the user
            return undefined;
        }

        return session;
    }

    /** Returns the active session with the specified key, if one exists. */
    getSession(key: `${string}-${string}-${string}-${string}-${string}`): Session | undefined {
        this.update();
        
        return this.sessions.get(key);
    }

    /** Adds a session to the active session collection. */
    registerSession(session: Session) {
        this.update();

        if (this.sessions.has(session.key)) {
            throw new Error("Session is already registered.");
        }
        
        this.sessions.set(session.key, session);

        // Create a timeout callback for the session
        this._createSessionTimeout(session);
    }

    /**
     * Deletes an active session, optionally retaining it as a tombstone.
     * @param key The key of the session to delete.
     * @param useTombstone Whether to retain the deleted session temporarily.
     * @returns The deleted session, or `undefined` if no active session was found.
     */
    deleteSession(key: `${string}-${string}-${string}-${string}-${string}`, reason: string, origin: Origin = Origin.server, useTombstone: boolean = true): Session | undefined {
        this.update();
        
        return this._updatelessDeleteSession(key, reason, origin, useTombstone);
    }

    /** Returns whether the specified key belongs to a retained tombstone. */
    isSessionDeleted(key: `${string}-${string}-${string}-${string}-${string}`): boolean {
        this.update();
        
        const tombstone = this.deletedSessions.get(key);

        if (tombstone) {
            return true;
        } else {
            return false;
        }
    }

    /** 
     * Returns a retained tombstone if the specified key belongs to one.
     * @returns `SessionTombstone` if a tombstone was found; otherwise, `undefined`
     */
    getTombstone(key: `${string}-${string}-${string}-${string}-${string}`): SessionTombstone | undefined {
        this.update();
        
        const tombstone = this.deletedSessions.get(key);

        if (tombstone) {
            return tombstone;
        } else {
            return undefined;
        }
    }

    /**
     * Marks a tombstone as read and removes it from the deleted-session collection.
     * @returns `true` if a tombstone was found; otherwise, `false`.
     */
    markTombstoneRead(key: `${string}-${string}-${string}-${string}-${string}`): boolean {
        this.update();
        
        const tombstoneCallback = this.tombstoneCallbacks.get(key);

        if (tombstoneCallback) {
            clearTimeout(tombstoneCallback);
            this.deletedSessions.delete(key);
            this.tombstoneCallbacks.delete(key);

            return true;
        }

        return false;
    }

    /** Returns whether the active session with the specified key is usable. */
    isUsable(key: `${string}-${string}-${string}-${string}-${string}`): boolean {
        const session = this.getSession(key);

        if (session) {
            return session.isUsable();
        } else {
            return false;
        }
    }

    /** Returns whether the active session has the specified capability. */
    canUse(key: `${string}-${string}-${string}-${string}-${string}`, capability: Capability, task: number): boolean {
        const session = this.getSession(key);

        if (session) {
            return session.canUse(capability, task);
        } else {
            return false;
        }
    }

    /** Marks that a session has been used, resetting its timeout. */
    markSessionUse(key: `${string}-${string}-${string}-${string}-${string}`) {
        this.update();
        
        const timeout = this.sessionTimeoutCallbacks.get(key);
        const session = this.sessions.get(key);

        if (timeout && session) {
            clearTimeout(timeout.timeout)
            this._createSessionTimeout(session);
        }
    }

    /** 
     * Updates the session manager so that session information is up-to-date.
     * **This should be run before any operation regarding the `SessionManager`!**
     * 
     * **NOTE:** This function does not need to be used externally; it is run before any operation nonetheless.
     */
    update() {
        // Check for expired sessions
        this.sessions.forEach((session) => {
            if (Date.now() >= session.expiry.getTime()) {
                this._updatelessDeleteSession(session.key, "expired");
            }
        });
    }
}