import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export class DesktopInputError extends Error {}
export class DesktopUnsupportedError extends Error {}

const virtualKeys: Record<string, number> = {
    BACKSPACE: 0x08,
    TAB: 0x09,
    ENTER: 0x0d,
    SHIFT: 0x10,
    CTRL: 0x11,
    ALT: 0x12,
    PAUSE: 0x13,
    CAPSLOCK: 0x14,
    ESC: 0x1b,
    SPACE: 0x20,
    PAGEUP: 0x21,
    PAGEDOWN: 0x22,
    END: 0x23,
    HOME: 0x24,
    LEFT: 0x25,
    UP: 0x26,
    RIGHT: 0x27,
    DOWN: 0x28,
    INSERT: 0x2d,
    DELETE: 0x2e,
    META: 0x5b,
    WIN: 0x5b
};

for (let code = 0x30; code <= 0x39; code++) {
    virtualKeys[String.fromCharCode(code)] = code;
}
for (let code = 0x41; code <= 0x5a; code++) {
    virtualKeys[String.fromCharCode(code)] = code;
}
for (let index = 1; index <= 12; index++) {
    virtualKeys[`F${index}`] = 0x70 + index - 1;
}

type DesktopAction =
    | { action: "mouse.move"; x: number; y: number }
    | { action: "mouse.click"; button: "left" | "right" | "middle" }
    | { action: "mouse.drag"; fromX: number; fromY: number; toX: number; toY: number; button: "left" | "right" | "middle" }
    | { action: "mouse.scroll"; amount: number }
    | { action: "keyboard.press"; keys: number[] }
    | { action: "keyboard.type"; text: string };

const powershellProgram = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class TcpioneerDesktopInput {
    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint flags, uint dx, uint dy, int data, UIntPtr extraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extraInfo);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int index);

    [StructLayout(LayoutKind.Sequential)]
    public struct Input {
        public uint Type;
        public InputUnion Union;
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct InputUnion {
        [FieldOffset(0)] public KeyboardInput Keyboard;
        [FieldOffset(0)] public MouseInput Mouse;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct KeyboardInput {
        public ushort VirtualKey;
        public ushort ScanCode;
        public uint Flags;
        public uint Time;
        public UIntPtr ExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct MouseInput {
        public int X;
        public int Y;
        public uint MouseData;
        public uint Flags;
        public uint Time;
        public UIntPtr ExtraInfo;
    }

    [DllImport("user32.dll", SetLastError = true)]
    public static extern uint SendInput(uint count, Input[] inputs, int size);

    public static void TypeUnicode(string text) {
        foreach (char character in text) {
            Input down = new Input();
            down.Type = 1;
            down.Union.Keyboard = new KeyboardInput();
            down.Union.Keyboard.ScanCode = character;
            down.Union.Keyboard.Flags = 4;

            Input up = new Input();
            up.Type = 1;
            up.Union.Keyboard = new KeyboardInput();
            up.Union.Keyboard.ScanCode = character;
            up.Union.Keyboard.Flags = 6;

            Input[] inputs = new Input[] { down, up };
            if (SendInput(2, inputs, Marshal.SizeOf(typeof(Input))) != 2) {
                throw new InvalidOperationException("Windows rejected keyboard text input.");
            }
        }
    }

    public static byte[] CaptureJpeg() {
        int left = GetSystemMetrics(76);
        int top = GetSystemMetrics(77);
        int width = GetSystemMetrics(78);
        int height = GetSystemMetrics(79);
        if (width <= 0 || height <= 0 || (long)width * height > 40000000) {
            throw new InvalidOperationException("The desktop dimensions are invalid or too large.");
        }

        using (Bitmap bitmap = new Bitmap(width, height))
        using (Graphics graphics = Graphics.FromImage(bitmap))
        using (MemoryStream stream = new MemoryStream()) {
            graphics.CopyFromScreen(left, top, 0, 0, bitmap.Size);
            bitmap.Save(stream, ImageFormat.Jpeg);
            return stream.ToArray();
        }
    }
}
'@ -ReferencedAssemblies System.Drawing

$data = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('__PAYLOAD__')) | ConvertFrom-Json
switch ($data.action) {
    'mouse.move' {
        if (-not [TcpioneerDesktopInput]::SetCursorPos([int]$data.x, [int]$data.y)) {
            throw 'Windows could not move the mouse pointer.'
        }
        [Console]::Out.WriteLine('OK')
    }
    'mouse.click' {
        $buttonFlags = switch ($data.button) {
            'left' { @(2, 4) }
            'right' { @(8, 16) }
            'middle' { @(32, 64) }
            default { throw 'Unsupported mouse button.' }
        }
        [TcpioneerDesktopInput]::mouse_event([uint32]$buttonFlags[0], 0, 0, 0, [UIntPtr]::Zero)
        [TcpioneerDesktopInput]::mouse_event([uint32]$buttonFlags[1], 0, 0, 0, [UIntPtr]::Zero)
        [Console]::Out.WriteLine('OK')
    }
    'mouse.drag' {
        $buttonFlags = switch ($data.button) {
            'left' { @(2, 4) }
            'right' { @(8, 16) }
            'middle' { @(32, 64) }
            default { throw 'Unsupported mouse button.' }
        }
        if (-not [TcpioneerDesktopInput]::SetCursorPos([int]$data.fromX, [int]$data.fromY)) {
            throw 'Windows could not move the mouse pointer to the drag start.'
        }
        [TcpioneerDesktopInput]::mouse_event([uint32]$buttonFlags[0], 0, 0, 0, [UIntPtr]::Zero)
        try {
            Start-Sleep -Milliseconds 50
            if (-not [TcpioneerDesktopInput]::SetCursorPos([int]$data.toX, [int]$data.toY)) {
                throw 'Windows could not move the mouse pointer to the drag end.'
            }
        } finally {
            [TcpioneerDesktopInput]::mouse_event([uint32]$buttonFlags[1], 0, 0, 0, [UIntPtr]::Zero)
        }
        [Console]::Out.WriteLine('OK')
    }
    'mouse.scroll' {
        [TcpioneerDesktopInput]::mouse_event(0x0800, 0, 0, [int]$data.amount, [UIntPtr]::Zero)
        [Console]::Out.WriteLine('OK')
    }
    'keyboard.press' {
        foreach ($key in $data.keys) {
            [TcpioneerDesktopInput]::keybd_event([byte]$key, 0, 0, [UIntPtr]::Zero)
        }
        for ($index = $data.keys.Count - 1; $index -ge 0; $index--) {
            [TcpioneerDesktopInput]::keybd_event([byte]$data.keys[$index], 0, 2, [UIntPtr]::Zero)
        }
        [Console]::Out.WriteLine('OK')
    }
    'keyboard.type' {
        [TcpioneerDesktopInput]::TypeUnicode([string]$data.text)
        [Console]::Out.WriteLine('OK')
    }
    'screenshot' {
        [Console]::Out.WriteLine([Convert]::ToBase64String([TcpioneerDesktopInput]::CaptureJpeg()))
    }
    default { throw 'Unsupported desktop action.' }
}
`;

function createScript(action: DesktopAction | { action: "screenshot" }): string {
    const payload = Buffer.from(JSON.stringify(action), "utf8").toString("base64");
    const script = powershellProgram.replace("__PAYLOAD__", payload);
    return Buffer.from(script, "utf16le").toString("base64");
}

async function runPowerShell(action: DesktopAction | { action: "screenshot" }): Promise<string> {
    if (process.platform !== "win32") {
        throw new DesktopUnsupportedError("Desktop control is currently supported only on Windows.");
    }

    try {
        const { stdout } = await execFileAsync("powershell.exe", [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-EncodedCommand",
            createScript(action)
        ], {
            windowsHide: true,
            timeout: 15000,
            maxBuffer: 32 * 1024 * 1024
        });

        return stdout.trim();
    } catch (error) {
        const stderr = error && typeof error === "object" && "stderr" in error && typeof error.stderr === "string"
            ? error.stderr.trim()
            : "";
        throw new Error(stderr || "PowerShell desktop operation failed.");
    }
}

export async function performDesktopAction(input: unknown): Promise<string> {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new Error("action must be a JSON object.");
    }

    const value = input as Record<string, unknown>;

    if (value.action === "mouse.move") {
        if (!Number.isInteger(value.x) || !Number.isInteger(value.y) ||
            (value.x as number) < -32768 || (value.x as number) > 32767 ||
            (value.y as number) < -32768 || (value.y as number) > 32767) {
            throw new DesktopInputError("mouse.move requires integer x and y coordinates between -32768 and 32767.");
        }
        return runPowerShell({ action: "mouse.move", x: value.x as number, y: value.y as number });
    }

    if (value.action === "mouse.click") {
        if (value.button !== "left" && value.button !== "right" && value.button !== "middle") {
            throw new DesktopInputError("mouse.click button must be left, right, or middle.");
        }
        return runPowerShell({ action: "mouse.click", button: value.button });
    }

    if (value.action === "mouse.drag") {
        const coordinates = [value.fromX, value.fromY, value.toX, value.toY];
        if (!coordinates.every((coordinate) => typeof coordinate === "number" &&
                Number.isInteger(coordinate) && coordinate >= -32768 && coordinate <= 32767) ||
            (value.button !== "left" && value.button !== "right" && value.button !== "middle")) {
            throw new DesktopInputError("mouse.drag requires integer start/end coordinates from -32768 to 32767 and a left, right, or middle button.");
        }
        return runPowerShell({
            action: "mouse.drag",
            fromX: value.fromX as number,
            fromY: value.fromY as number,
            toX: value.toX as number,
            toY: value.toY as number,
            button: value.button
        });
    }

    if (value.action === "mouse.scroll") {
        if (!Number.isInteger(value.amount) || (value.amount as number) < -1200 || (value.amount as number) > 1200) {
            throw new DesktopInputError("mouse.scroll amount must be an integer between -1200 and 1200.");
        }
        return runPowerShell({ action: "mouse.scroll", amount: value.amount as number });
    }

    if (value.action === "keyboard.press") {
        if (!Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 4 ||
            !value.keys.every((key) => typeof key === "string" && Object.hasOwn(virtualKeys, key.toUpperCase()))) {
            throw new DesktopInputError("keyboard.press keys must contain 1 to 4 supported key names.");
        }
        const keys = value.keys.map((key) => virtualKeys[(key as string).toUpperCase()]);
        if (new Set(keys).size !== keys.length) {
            throw new DesktopInputError("keyboard.press cannot contain the same key more than once.");
        }
        if (keys.includes(0x5b) && keys.includes(0x12) && keys.includes(0x11)) {
            throw new DesktopInputError("The Windows key cannot be combined with Ctrl and Alt.");
        }
        return runPowerShell({ action: "keyboard.press", keys });
    }

    if (value.action === "keyboard.type") {
        if (typeof value.text !== "string" || value.text.length > 2000) {
            throw new DesktopInputError("keyboard.type text must be a string no longer than 2000 characters.");
        }
        return runPowerShell({ action: "keyboard.type", text: value.text });
    }

    throw new DesktopInputError("Unsupported action. Use mouse.move, mouse.click, mouse.drag, mouse.scroll, keyboard.press, or keyboard.type.");
}

export async function captureScreenshot(): Promise<Buffer> {
    const encoded = await runPowerShell({ action: "screenshot" });
    if (!encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
        throw new Error("Windows returned an invalid screenshot.");
    }
    return Buffer.from(encoded, "base64");
}
