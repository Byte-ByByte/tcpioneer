import { Type } from '@sinclair/typebox';

const ConfigFileRef = Type.Object({
    configVersion: Type.Integer({ minimum: 1 }),
    server: Type.Object({
        host: Type.String(),
        port: Type.Integer(),
        noSessionsBefore: Type.Optional(Type.String())
    }),
    security: Type.Object({
        token: Type.String(),
        generateToken: Type.Optional(Type.Boolean())
    }),
    "log-options": Type.Object({
        "shown-severities": Type.Object({
            "debug": Type.Boolean(),
            "info": Type.Boolean(),
            "notice": Type.Boolean(),
            "warn": Type.Boolean(),
            "error": Type.Boolean(),
            "critical": Type.Boolean(),
            "alert": Type.Boolean(),
            "emergency": Type.Boolean()
        })
    }),
    session: Type.Object({
        timeout: Type.Integer({ minimum: 0 }),
        capabilities: Type.Array(Type.Object(
            {
                capability: Type.String(),
                tasks: Type.Array(Type.Integer())
            }
        )),
        expiryOffset: Type.Object({
            days: Type.Optional(Type.Integer({ minimum: 0 })),
            hours: Type.Optional(Type.Integer({ minimum: 0 })),
            minutes: Type.Optional(Type.Integer({ minimum: 0 })),
            seconds: Type.Optional(Type.Integer({ minimum: 0 })),
        })
    }),
    guide: Type.Object({
        location: Type.String()
    })
})

export default ConfigFileRef;