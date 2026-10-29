const fs = require("node:fs");
const path = require("node:path");

function makePixels(size) {
    const pixels = Buffer.alloc(size * size * 4);
    const scale = size / 64;
    const rounded = (x, y, box, radius) => {
        const [left, top, width, height] = box.map((value) => value * scale);
        const r = radius * scale;
        const cx = Math.max(left + r, Math.min(x + 0.5, left + width - r));
        const cy = Math.max(top + r, Math.min(y + 0.5, top + height - r));
        return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r ** 2;
    };
    const fillRounded = (box, radius, color) => {
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            if (!rounded(x, y, box, radius)) continue;
            const index = (y * size + x) * 4;
            pixels[index] = color[0];
            pixels[index + 1] = color[1];
            pixels[index + 2] = color[2];
            pixels[index + 3] = 255;
        }
    };
    const fillRect = (left, top, width, height, color) => {
        const x0 = Math.floor(left * scale), y0 = Math.floor(top * scale);
        const x1 = Math.ceil((left + width) * scale), y1 = Math.ceil((top + height) * scale);
        for (let y = Math.max(0, y0); y < Math.min(size, y1); y++) {
            for (let x = Math.max(0, x0); x < Math.min(size, x1); x++) {
                const index = (y * size + x) * 4;
                pixels[index] = color[0];
                pixels[index + 1] = color[1];
                pixels[index + 2] = color[2];
                pixels[index + 3] = 255;
            }
        }
    };
    const fillPolygon = (points, color) => {
        const scaled = points.map(([x, y]) => [x * scale, y * scale]);
        const minX = Math.max(0, Math.floor(Math.min(...scaled.map((p) => p[0]))));
        const maxX = Math.min(size - 1, Math.ceil(Math.max(...scaled.map((p) => p[0]))));
        const minY = Math.max(0, Math.floor(Math.min(...scaled.map((p) => p[1]))));
        const maxY = Math.min(size - 1, Math.ceil(Math.max(...scaled.map((p) => p[1]))));
        for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
            let inside = false;
            for (let i = 0, j = scaled.length - 1; i < scaled.length; j = i++) {
                const [xi, yi] = scaled[i], [xj, yj] = scaled[j];
                const crosses = (yi > y + 0.5) !== (yj > y + 0.5) &&
                    x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi;
                if (crosses) inside = !inside;
            }
            if (inside) {
                const index = (y * size + x) * 4;
                pixels[index] = color[0];
                pixels[index + 1] = color[1];
                pixels[index + 2] = color[2];
                pixels[index + 3] = 255;
            }
        }
    };

    fillRounded([4, 4, 56, 56], 12, [11, 18, 32]);
    fillRounded([11, 12, 42, 32], 5, [56, 189, 248]);
    fillRounded([14, 15, 36, 25], 2, [20, 33, 55]);
    fillRect(29, 44, 6, 7, [56, 189, 248]);
    fillRounded([23, 49, 18, 4], 2, [56, 189, 248]);
    fillRect(18, 19, 4, 2, [34, 197, 94]);
    fillRect(24, 19, 4, 2, [56, 189, 248]);
    fillRect(30, 19, 4, 2, [56, 189, 248]);
    fillPolygon([[27, 23], [27, 39], [32, 34], [36, 43], [40, 41], [36, 32], [43, 32]], [241, 245, 249]);
    return pixels;
}

function makeImage(size) {
    const pixels = makePixels(size);
    const rowBytes = size * 4;
    const xor = Buffer.alloc(rowBytes * size);
    for (let y = 0; y < size; y++) {
        const sourceY = size - 1 - y;
        for (let x = 0; x < size; x++) {
            const source = (sourceY * size + x) * 4;
            const target = y * rowBytes + x * 4;
            xor[target] = pixels[source + 2];
            xor[target + 1] = pixels[source + 1];
            xor[target + 2] = pixels[source];
            xor[target + 3] = pixels[source + 3];
        }
    }
    const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
    const header = Buffer.alloc(40);
    header.writeUInt32LE(40, 0);
    header.writeInt32LE(size, 4);
    header.writeInt32LE(size * 2, 8);
    header.writeUInt16LE(1, 12);
    header.writeUInt16LE(32, 14);
    header.writeUInt32LE(0, 16);
    header.writeUInt32LE(xor.length + mask.length, 20);
    return Buffer.concat([header, xor, mask]);
}

const sizes = [16, 32, 48, 64, 256];
const images = sizes.map(makeImage);
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(0, 0);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
for (let index = 0; index < sizes.length; index++) {
    const entry = 6 + index * 16;
    const size = sizes[index];
    directory[entry] = size === 256 ? 0 : size;
    directory[entry + 1] = size === 256 ? 0 : size;
    directory[entry + 2] = 0;
    directory[entry + 3] = 0;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(images[index].length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += images[index].length;
}
const output = path.resolve(__dirname, "../assets/tcpioneer.ico");
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([directory, ...images]));
console.log("Created assets/tcpioneer.ico");
