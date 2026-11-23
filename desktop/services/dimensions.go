package services

import (
	"bytes"
	"encoding/binary"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// A container cannot be huge just to learn two numbers.
const maxHeaderRead = 64 << 20

var (
	svgTagRE    = regexp.MustCompile(`(?is)<svg\b([^>]*)>`)
	svgWidthRE  = regexp.MustCompile(`(?i)\bwidth\s*=\s*["']\s*([0-9.]+)\s*(px)?\s*["']`)
	svgHeightRE = regexp.MustCompile(`(?i)\bheight\s*=\s*["']\s*([0-9.]+)\s*(px)?\s*["']`)
	svgViewRE   = regexp.MustCompile(`(?i)\bviewBox\s*=\s*["']\s*[-0-9.]+\s+[-0-9.]+\s+([0-9.]+)\s+([0-9.]+)\s*["']`)
)

// mediaDimensions returns the pixel size of an image or video so a new card can
// keep the source ratio. Zeros mean the size is unknown.
func mediaDimensions(path, mimeType string) (int, int) {
	if strings.HasPrefix(mimeType, "image/") {
		return imageDimensions(path, mimeType)
	}
	if strings.HasPrefix(mimeType, "video/") {
		return videoDimensions(path)
	}
	return 0, 0
}

func imageDimensions(path, mimeType string) (int, int) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0
	}
	defer file.Close()

	head := make([]byte, 64<<10)
	n, _ := file.Read(head)
	head = head[:n]

	if mimeType == "image/svg+xml" || strings.EqualFold(filepath.Ext(path), ".svg") {
		return svgDimensions(head)
	}
	if isAVIF(head, path) {
		if info, statErr := file.Stat(); statErr == nil {
			if width, height := avifDimensions(file, info.Size()); width > 0 && height > 0 {
				return width, height
			}
		}
	}
	if strings.EqualFold(filepath.Ext(path), ".webp") || bytes.HasPrefix(head, []byte("RIFF")) && len(head) > 12 && string(head[8:12]) == "WEBP" {
		return webpDimensions(head)
	}
	if bytes.HasPrefix(head, []byte("BM")) {
		return bmpDimensions(head)
	}

	cfg, _, err := image.DecodeConfig(bytes.NewReader(head))
	if err == nil && cfg.Width > 0 && cfg.Height > 0 {
		return cfg.Width, cfg.Height
	}
	// The header may sit past the first read for some containers.
	if _, err := file.Seek(0, 0); err == nil {
		if cfg, _, err := image.DecodeConfig(file); err == nil {
			return cfg.Width, cfg.Height
		}
	}
	return 0, 0
}

// isAVIF matches both the extension and the file brand, since the picker may
// hand over a renamed file with a generic mime type.
func isAVIF(head []byte, path string) bool {
	if strings.EqualFold(filepath.Ext(path), ".avif") {
		return true
	}
	if len(head) >= 12 && string(head[4:8]) == "ftyp" {
		brand := string(head[8:12])
		return brand == "avif" || brand == "avis"
	}
	return false
}

func svgDimensions(head []byte) (int, int) {
	tag := svgTagRE.FindSubmatch(head)
	if tag == nil {
		return 0, 0
	}
	attrs := string(tag[1])
	if view := svgViewRE.FindStringSubmatch(attrs); view != nil {
		w, errW := strconv.ParseFloat(view[1], 64)
		h, errH := strconv.ParseFloat(view[2], 64)
		if errW == nil && errH == nil && w > 0 && h > 0 {
			return int(w + 0.5), int(h + 0.5)
		}
	}
	w, errW := svgLength(attrs, svgWidthRE)
	h, errH := svgLength(attrs, svgHeightRE)
	if errW == nil && errH == nil && w > 0 && h > 0 {
		return int(w + 0.5), int(h + 0.5)
	}
	return 0, 0
}

func svgLength(attrs string, re *regexp.Regexp) (float64, error) {
	match := re.FindStringSubmatch(attrs)
	if match == nil {
		return 0, strconv.ErrSyntax
	}
	return strconv.ParseFloat(match[1], 64)
}

func webpDimensions(head []byte) (int, int) {
	if len(head) < 30 {
		return 0, 0
	}
	chunk := string(head[12:16])
	switch chunk {
	case "VP8X":
		width := int(head[24]) | int(head[25])<<8 | int(head[26])<<16
		height := int(head[27]) | int(head[28])<<8 | int(head[29])<<16
		return width + 1, height + 1
	case "VP8 ":
		// Frame tag, start code, then 14-bit width and height.
		if !bytes.Equal(head[23:26], []byte{0x9d, 0x01, 0x2a}) {
			return 0, 0
		}
		width := int(binary.LittleEndian.Uint16(head[26:28]) & 0x3fff)
		height := int(binary.LittleEndian.Uint16(head[28:30]) & 0x3fff)
		return width, height
	case "VP8L":
		if head[20] != 0x2f {
			return 0, 0
		}
		bits := binary.LittleEndian.Uint32(head[21:25])
		width := int(bits&0x3fff) + 1
		height := int((bits>>14)&0x3fff) + 1
		return width, height
	}
	return 0, 0
}

func bmpDimensions(head []byte) (int, int) {
	if len(head) < 26 {
		return 0, 0
	}
	width := int(int32(binary.LittleEndian.Uint32(head[18:22])))
	height := int(int32(binary.LittleEndian.Uint32(head[22:26])))
	if height < 0 {
		height = -height
	}
	if width > 0 && height > 0 {
		return width, height
	}
	return 0, 0
}

func videoDimensions(path string) (int, int) {
	file, err := os.Open(path)
	if err != nil {
		return 0, 0
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return 0, 0
	}
	return mp4Dimensions(file, info.Size())
}

// mp4Dimensions scans the top-level boxes for the movie header and reads the
// first track with a non-zero size. It covers mp4, mov and m4v.
func mp4Dimensions(file *os.File, size int64) (int, int) {
	moov := readTopLevelBox(file, size, "moov")
	if moov == nil {
		return 0, 0
	}
	return tkhdDimensions(moov)
}

// readTopLevelBox returns the payload of the first top-level box of the given
// kind. Only box headers are read while skipping, so a movie header at the end
// of a large file is found without loading the media.
func readTopLevelBox(file *os.File, size int64, wanted string) []byte {
	var offset int64
	for offset+8 <= size {
		var header [16]byte
		if _, err := file.ReadAt(header[:8], offset); err != nil {
			return nil
		}
		boxSize := int64(binary.BigEndian.Uint32(header[:4]))
		boxType := string(header[4:8])
		headerLen := int64(8)
		if boxSize == 1 {
			if _, err := file.ReadAt(header[8:16], offset+8); err != nil {
				return nil
			}
			boxSize = int64(binary.BigEndian.Uint64(header[8:16]))
			headerLen = 16
		} else if boxSize == 0 {
			boxSize = size - offset
		}
		if boxSize < headerLen || offset+boxSize > size {
			return nil
		}
		if boxType == wanted {
			if boxSize-headerLen > maxHeaderRead {
				return nil
			}
			data := make([]byte, boxSize-headerLen)
			if _, err := file.ReadAt(data, offset+headerLen); err != nil {
				return nil
			}
			return data
		}
		offset += boxSize
	}
	return nil
}

// walkBoxes visits the children of an in-memory ISOBMFF box list.
func walkBoxes(data []byte, visit func(kind string, body []byte) bool) {
	for offset := 0; offset+8 <= len(data); {
		size := int(binary.BigEndian.Uint32(data[offset : offset+4]))
		kind := string(data[offset+4 : offset+8])
		header := 8
		if size == 1 {
			if offset+16 > len(data) {
				return
			}
			size = int(binary.BigEndian.Uint64(data[offset+8 : offset+16]))
			header = 16
		} else if size == 0 {
			size = len(data) - offset
		}
		if size < header || offset+size > len(data) {
			return
		}
		if visit(kind, data[offset+header:offset+size]) {
			return
		}
		offset += size
	}
}

// avifDimensions reads the image spatial extents from the item properties.
// A file may carry several (tiles, thumbnails); the largest one is the image.
func avifDimensions(file *os.File, size int64) (int, int) {
	meta := readTopLevelBox(file, size, "meta")
	if len(meta) < 4 {
		return 0, 0
	}
	width, height := 0, 0
	walkBoxes(meta[4:], func(kind string, iprp []byte) bool {
		if kind != "iprp" {
			return false
		}
		walkBoxes(iprp, func(kind string, ipco []byte) bool {
			if kind != "ipco" {
				return false
			}
			walkBoxes(ipco, func(kind string, ispe []byte) bool {
				if kind == "ispe" {
					if w, h := readIspe(ispe); w*h > width*height {
						width, height = w, h
					}
				}
				return false
			})
			return false
		})
		return false
	})
	return width, height
}

func readIspe(body []byte) (int, int) {
	if len(body) < 12 {
		return 0, 0
	}
	return int(binary.BigEndian.Uint32(body[4:8])), int(binary.BigEndian.Uint32(body[8:12]))
}

// tkhdDimensions walks the moov payload looking for track headers. Width and
// height are 16.16 fixed point at the end of every version of the box.
func tkhdDimensions(moov []byte) (int, int) {
	width, height := 0, 0
	walkBoxes(moov, func(kind string, body []byte) bool {
		switch kind {
		case "trak":
			if w, h := tkhdDimensions(body); w > 0 && h > 0 {
				width, height = w, h
				return true
			}
		case "tkhd":
			if w, h := readTkhd(body); w > 0 && h > 0 {
				width, height = w, h
				return true
			}
		}
		return false
	})
	return width, height
}

func readTkhd(body []byte) (int, int) {
	if len(body) < 4 {
		return 0, 0
	}
	// version/flags, then two dates, track id, reserved, duration, reserved,
	// layer, alternate group, volume, reserved, matrix.
	offset := 4
	if body[0] == 1 {
		offset += 8 + 8 + 4 + 4 + 8
	} else {
		offset += 4 + 4 + 4 + 4 + 4
	}
	offset += 8 + 2 + 2 + 2 + 2 + 36
	if offset+8 > len(body) {
		return 0, 0
	}
	width := int(binary.BigEndian.Uint32(body[offset:offset+4]) >> 16)
	height := int(binary.BigEndian.Uint32(body[offset+4:offset+8]) >> 16)
	return width, height
}
