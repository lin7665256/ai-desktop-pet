import struct
import zlib

# Create a minimal 32x32 RGBA PNG (purple square)
width, height = 32, 32
raw_data = b''
for y in range(height):
    raw_data += b'\x00'  # filter byte
    for x in range(width):
        raw_data += bytes([102, 126, 234, 255])  # RGBA purple

# PNG signature
signature = b'\x89PNG\r\n\x1a\n'

# IHDR chunk
ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data)
ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc & 0xffffffff)

# IDAT chunk
compressed = zlib.compress(raw_data)
idat_crc = zlib.crc32(b'IDAT' + compressed)
idat = struct.pack('>I', len(compressed)) + b'IDAT' + compressed + struct.pack('>I', idat_crc & 0xffffffff)

# IEND chunk
iend_crc = zlib.crc32(b'IEND')
iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc & 0xffffffff)

# Write PNG
with open('icon.png', 'wb') as f:
    f.write(signature + ihdr + idat + iend)

# Create ICO from PNG
with open('icon.png', 'rb') as f:
    png_data = f.read()

ico_header = struct.pack('<HHH', 0, 1, 1)  # reserved, type=icon, count=1
ico_entry = struct.pack('<BBBBHHII', width, height, 0, 0, 1, 32, len(png_data), 22)
with open('icon.ico', 'wb') as f:
    f.write(ico_header + ico_entry + png_data)

print("Created icon.png and icon.ico")
