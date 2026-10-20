import chalk from "chalk"

export type TextGenerator = (textinput: string[]) => string

export const startText: TextGenerator = (textinput) => {
    return `
    ${chalk.blue.bold("--- TCPIOneer ---")}
    ${chalk.green("Process started at")} ${textinput[0]}

    ${chalk.blue("-- Server Info --")}
    ${chalk.green("Host: ")} ${textinput[1]}
    ${chalk.green("Port: ")} ${textinput[2]}
<<<<<<< HEAD:packages/core/src/util/messages.ts

    ${chalk.blue("-- Connection --")}
    ${chalk.green("Browser: ")} ${textinput[3]}
    ${chalk.green("AIs: ")} GET ${textinput[3]}/ai
    ${chalk.green("HTTP API: ")} GET ${textinput[3]}/api
    ${chalk.green("Authorization: ")} Bearer <access-token from config.json>
=======
>>>>>>> 675d251171ef04fc95381cc71331ebbf8612e493:packages/core/src/messages.ts

    ${chalk.gray("Ctrl + H for shortcut help")}

${chalk.gray("-- log start --")}
`;
}

const helpAtomic: TextGenerator = (textinput) => {
    return `${chalk.green(textinput[0])} ${textinput[1]}`
}

export const helpText: TextGenerator = (_) => {
    return `
${chalk.green("-- help start --")}

    ${chalk.blue("- Local shortcuts (when TCPIOneer is active) -")}
    ${helpAtomic(["Ctrl + H", "opens this help menu"])}
    ${helpAtomic(["Ctrl + C", `forcefully quits TCPIOneer. ${chalk.red("Config changes from TCPIOneer may NOT SAVE.")}`])}
    ${helpAtomic(["Ctrl + Alt + A", "toggles the ability to create new sessions"])}
    ${helpAtomic(["Ctrl + Alt + C", "gracefully quits TCPIOneer, waits for current session to end before closing server"])}
    ${chalk.blue("- Global shortcuts (activate even when minimized) -")}
    ${helpAtomic(["Ctrl + Alt + Shift + F", `forcefully quits TCPIOneer, used as an ${chalk.red("emergency failsafe")}.`])}

${chalk.green("-- help end --")}
`
}
