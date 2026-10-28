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
    PRINTSCREEN: 0x2c,
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
    | { action: "keyboard.type"; text: string }
    | { action: "screenshot"; maxWidth: number; quality: number }
    | { action: "accessibility"; maxNodes: number; maxDepth: number };

const powershellProgram = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;

public static class TcpioneerDesktopInput {
    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint flags, uint dx, uint dy, int data, UIntPtr extraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extraInfo);

    [DllImport("user32.dll")]
    public static extern int GetSystemMetrics(int index);

    static TcpioneerDesktopInput() {
        try {
            SetProcessDPIAware();
        } catch {}
    }

    private static bool IsExtendedKey(byte key) {
        return key == 0x21 || key == 0x22 || key == 0x23 || key == 0x24 ||
               key == 0x25 || key == 0x26 || key == 0x27 || key == 0x28 ||
               key == 0x2d || key == 0x2e || key == 0x5b || key == 0x5c ||
               key == 0x2c;
    }

    public static void SendKeyEvent(byte key, bool isUp) {
        uint flags = 0;
        if (IsExtendedKey(key)) flags |= 1; // KEYEVENTF_EXTENDEDKEY
        if (isUp) flags |= 2; // KEYEVENTF_KEYUP
        keybd_event(key, 0, flags, UIntPtr.Zero);
    }

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
            down.Union.Keyboard.Flags = 4; // KEYEVENTF_UNICODE

            Input up = new Input();
            up.Type = 1;
            up.Union.Keyboard = new KeyboardInput();
            up.Union.Keyboard.ScanCode = character;
            up.Union.Keyboard.Flags = 6; // KEYEVENTF_UNICODE | KEYEVENTF_KEYUP

            Input[] inputs = new Input[] { down, up };
            if (SendInput(2, inputs, Marshal.SizeOf(typeof(Input))) != 2) {
                throw new InvalidOperationException("Windows rejected keyboard text input.");
            }
        }
    }

    public static byte[] CaptureJpeg(int maxWidth, long quality) {
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
            Bitmap output = bitmap;
            if (width > maxWidth) {
                int scaledHeight = Math.Max(1, (int)Math.Round((double)height * maxWidth / width));
                output = new Bitmap(maxWidth, scaledHeight);
                using (Graphics resizeGraphics = Graphics.FromImage(output)) {
                    resizeGraphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                    resizeGraphics.DrawImage(bitmap, 0, 0, maxWidth, scaledHeight);
                }
            }

            try {
                ImageCodecInfo jpegCodec = Array.Find(ImageCodecInfo.GetImageEncoders(), delegate(ImageCodecInfo codec) {
                    return codec.MimeType == "image/jpeg";
                });
                using (EncoderParameters parameters = new EncoderParameters(1)) {
                    parameters.Param[0] = new EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
                    output.Save(stream, jpegCodec, parameters);
                }
                return stream.ToArray();
            } finally {
                if (!Object.ReferenceEquals(output, bitmap)) output.Dispose();
            }
        }
    }

    public static void DragMouse(int fromX, int fromY, int toX, int toY, uint downFlag, uint upFlag) {
        if (!SetCursorPos(fromX, fromY)) {
            throw new InvalidOperationException("Could not move mouse to start position.");
        }
        mouse_event(downFlag, 0, 0, 0, UIntPtr.Zero);
        try {
            int steps = 10;
            for (int i = 1; i <= steps; i++) {
                int cx = fromX + (toX - fromX) * i / steps;
                int cy = fromY + (toY - fromY) * i / steps;
                SetCursorPos(cx, cy);
                Thread.Sleep(5);
            }
        } finally {
            mouse_event(upFlag, 0, 0, 0, UIntPtr.Zero);
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
        [TcpioneerDesktopInput]::DragMouse([int]$data.fromX, [int]$data.fromY, [int]$data.toX, [int]$data.toY, [uint32]$buttonFlags[0], [uint32]$buttonFlags[1])
        [Console]::Out.WriteLine('OK')
    }
    'mouse.scroll' {
        [TcpioneerDesktopInput]::mouse_event(0x0800, 0, 0, [int]$data.amount, [UIntPtr]::Zero)
        [Console]::Out.WriteLine('OK')
    }
    'keyboard.press' {
        foreach ($key in $data.keys) {
            [TcpioneerDesktopInput]::SendKeyEvent([byte]$key, $false)
        }
        for ($index = $data.keys.Count - 1; $index -ge 0; $index--) {
            [TcpioneerDesktopInput]::SendKeyEvent([byte]$data.keys[$index], $true)
        }
        [Console]::Out.WriteLine('OK')
    }
    'keyboard.type' {
        [TcpioneerDesktopInput]::TypeUnicode([string]$data.text)
        [Console]::Out.WriteLine('OK')
    }
    'screenshot' {
        $image = [Convert]::ToBase64String([TcpioneerDesktopInput]::CaptureJpeg([int]$data.maxWidth, [long]$data.quality))
        $capture = [ordered]@{
            image = $image
            width = [TcpioneerDesktopInput]::GetSystemMetrics(78)
            height = [TcpioneerDesktopInput]::GetSystemMetrics(79)
            left = [TcpioneerDesktopInput]::GetSystemMetrics(76)
            top = [TcpioneerDesktopInput]::GetSystemMetrics(77)
        }
        ConvertTo-Json -InputObject $capture -Compress
    }
    'accessibility' {
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        $script:nodeCount = 0
        function Get-AccessibilityNode($element, [int]$depth, [int]$maxDepth, [int]$maxNodes) {
            if ($script:nodeCount -ge $maxNodes) { return $null }
            $current = $element.Current
            if ($current.IsOffscreen) { return $null }
            $script:nodeCount++
            $name = if ($current.IsPassword) { '[password]' } else { [string]$current.Name }
            if ($name.Length -gt 160) { $name = $name.Substring(0, 160) }
            $automationId = [string]$current.AutomationId
            if ($automationId.Length -gt 128) { $automationId = $automationId.Substring(0, 128) }
            $bounds = $current.BoundingRectangle
            $node = [ordered]@{
                name = $name
                role = $current.ControlType.ProgrammaticName
                automationId = $automationId
                enabled = [bool]$current.IsEnabled
                bounds = @{ x = $bounds.X; y = $bounds.Y; width = $bounds.Width; height = $bounds.Height }
                children = @()
            }
            if ($depth -lt $maxDepth) {
                $children = $element.FindAll([System.Windows.Automation.TreeScope]::Children, [System.Windows.Automation.Condition]::TrueCondition)
                foreach ($child in $children) {
                    if ($script:nodeCount -ge $maxNodes) { break }
                    $childNode = Get-AccessibilityNode $child ($depth + 1) $maxDepth $maxNodes
                    if ($null -ne $childNode) { $node.children += ,$childNode }
                }
            }
            return $node
        }
        $root = [System.Windows.Automation.AutomationElement]::RootElement
        $tree = Get-AccessibilityNode $root 0 ([int]$data.maxDepth) ([int]$data.maxNodes)
        ConvertTo-Json -InputObject $tree -Depth 10 -Compress
    }
    default { throw 'Unsupported desktop action.' }
}
`;

function createScript(action: DesktopAction): string {
    const payload = Buffer.from(JSON.stringify(action), "utf8").toString("base64");
    const script = powershellProgram.replace("__PAYLOAD__", payload);
    return Buffer.from(script, "utf16le").toString("base64");
}

async function runPowerShell(action: DesktopAction): Promise<string> {
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
        if (!Array.isArray(value.keys) || value.keys.length < 1 || value.keys.length > 4) {
            throw new DesktopInputError("keyboard.press keys must contain 1 to 4 key names or virtual key numbers.");
        }
        const keys: number[] = [];
        for (const key of value.keys) {
            if (typeof key === "number" && Number.isInteger(key) && key >= 1 && key <= 255) {
                keys.push(key);
            } else if (typeof key === "string" && Object.hasOwn(virtualKeys, key.toUpperCase())) {
                keys.push(virtualKeys[key.toUpperCase()]);
            } else {
                throw new DesktopInputError(`Unsupported key: ${String(key)}`);
            }
        }
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

export async function captureScreenshot(options: { maxWidth?: number; quality?: number } = {}): Promise<{
    image: Buffer;
    width: number;
    height: number;
    left: number;
    top: number;
}> {
    const maxWidth = options.maxWidth ?? 1920;
    const quality = options.quality ?? 65;
    if (!Number.isInteger(maxWidth) || maxWidth < 320 || maxWidth > 3840 ||
        !Number.isInteger(quality) || quality < 30 || quality > 90) {
        throw new DesktopInputError("Screenshot maxWidth must be 320-3840 and quality must be 30-90.");
    }
    const encoded = await runPowerShell({ action: "screenshot", maxWidth, quality });
    try {
        const capture = JSON.parse(encoded) as { image?: unknown; width?: unknown; height?: unknown; left?: unknown; top?: unknown };
        if (typeof capture.image !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(capture.image) ||
            !Number.isInteger(capture.width) || !Number.isInteger(capture.height) ||
            !Number.isInteger(capture.left) || !Number.isInteger(capture.top)) {
            throw new Error("invalid capture metadata");
        }
        return {
            image: Buffer.from(capture.image, "base64"),
            width: capture.width as number,
            height: capture.height as number,
            left: capture.left as number,
            top: capture.top as number
        };
    } catch {
        throw new Error("Windows returned an invalid screenshot.");
    }
}

export async function captureAccessibilityTree(options: { maxNodes: number; maxDepth: number }): Promise<unknown> {
    if (!Number.isInteger(options.maxNodes) || options.maxNodes < 1 || options.maxNodes > 500 ||
        !Number.isInteger(options.maxDepth) || options.maxDepth < 1 || options.maxDepth > 8) {
        throw new DesktopInputError("Accessibility maxNodes must be 1-500 and maxDepth must be 1-8.");
    }
    const result = await runPowerShell({ action: "accessibility", ...options });
    try {
        return JSON.parse(result);
    } catch {
        throw new Error("Windows returned an invalid accessibility tree.");
    }
}
