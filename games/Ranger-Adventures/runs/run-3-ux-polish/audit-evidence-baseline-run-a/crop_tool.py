#!/usr/bin/env python3
"""Pure-python PNG crop/upscale/measure helper for the Run-A audit sittings.

No game code, no deps. Decodes 8-bit RGB(A) PNGs, writes crops (nearest-neighbor
upscaled) so Fable can LOOK at UI details at readable size, and measures color-
mask bounding boxes (e.g. button heights) in CSS px.

Usage:
  python3 crop_tool.py crop  <in.png> <out.png> <x0> <y0> <x1> <y1> [scale]
  python3 crop_tool.py mask  <in.png> <x0> <y0> <x1> <y1> <rmin> <rmax> <gmin> <gmax> <bmin> <bmax>
"""
import struct, sys, zlib


def read_png(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n'
    pos, w, h, bitd, ctype = 8, 0, 0, 0, 0
    idat = b''
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, bitd, ctype = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT':
            idat += chunk
        elif typ == b'IEND':
            break
        pos += 12 + ln
    assert bitd == 8 and ctype in (2, 6), f'unsupported png {bitd}/{ctype}'
    ch = 3 if ctype == 2 else 4
    raw = zlib.decompress(idat)
    stride = w * ch
    out = bytearray(h * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(h):
        filt = raw[p]; p += 1
        line = bytearray(raw[p:p + stride]); p += stride
        if filt == 1:
            for i in range(ch, stride):
                line[i] = (line[i] + line[i - ch]) & 255
        elif filt == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 255
        elif filt == 3:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 255
        elif filt == 4:
            for i in range(stride):
                a = line[i - ch] if i >= ch else 0
                b = prev[i]
                c = prev[i - ch] if i >= ch else 0
                pa, pb, pc = abs(b - c), abs(a - c), abs(a + b - 2 * c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 255
        out[y * stride:(y + 1) * stride] = line
        prev = line
    return w, h, ch, out


def write_png(path, w, h, ch, pix):
    raw = b''.join(b'\x00' + bytes(pix[y * w * ch:(y + 1) * w * ch]) for y in range(h))
    ctype = 2 if ch == 3 else 6

    def chunk(typ, payload):
        c = struct.pack('>I', len(payload)) + typ + payload
        return c + struct.pack('>I', zlib.crc32(typ + payload) & 0xffffffff)

    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, ctype, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(raw, 6)))
        f.write(chunk(b'IEND', b''))


def crop(src, dst, x0, y0, x1, y1, scale=1):
    w, h, ch, pix = read_png(src)
    x0, y0 = max(0, x0), max(0, y0)
    x1, y1 = min(w, x1), min(h, y1)
    cw, chh = x1 - x0, y1 - y0
    out = bytearray(cw * scale * chh * scale * ch)
    ow = cw * scale
    for y in range(chh * scale):
        sy = y0 + y // scale
        for x in range(ow):
            sx = x0 + x // scale
            si = (sy * w + sx) * ch
            di = (y * ow + x) * ch
            out[di:di + ch] = pix[si:si + ch]
    write_png(dst, ow, chh * scale, ch, out)
    print(f'wrote {dst} ({ow}x{chh * scale}) from ({x0},{y0})-({x1},{y1})')


def mask(src, x0, y0, x1, y1, rmin, rmax, gmin, gmax, bmin, bmax):
    w, h, ch, pix = read_png(src)
    xs, ys, n = [], [], 0
    for y in range(max(0, y0), min(h, y1)):
        for x in range(max(0, x0), min(w, x1)):
            i = (y * w + x) * ch
            r, g, b = pix[i], pix[i + 1], pix[i + 2]
            if rmin <= r <= rmax and gmin <= g <= gmax and bmin <= b <= bmax:
                xs.append(x); ys.append(y); n += 1
    if not n:
        print('no pixels matched')
        return
    print(f'{n} px matched; bbox x {min(xs)}..{max(xs)} (w={max(xs)-min(xs)+1}), '
          f'y {min(ys)}..{max(ys)} (h={max(ys)-min(ys)+1})')


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'crop':
        a = sys.argv[2:]
        crop(a[0], a[1], *map(int, a[2:6]), int(a[6]) if len(a) > 6 else 1)
    elif cmd == 'mask':
        a = sys.argv[2:]
        mask(a[0], *map(int, a[1:11]))
