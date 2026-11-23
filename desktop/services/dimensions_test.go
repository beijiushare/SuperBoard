package services

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func writeTemp(t *testing.T, name string, data []byte) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("write temp: %v", err)
	}
	return path
}

func TestImageDimensionsPNG(t *testing.T) {
	source := image.NewRGBA(image.Rect(0, 0, 40, 24))
	source.Set(0, 0, color.RGBA{R: 255, A: 255})
	var buffer bytes.Buffer
	if err := png.Encode(&buffer, source); err != nil {
		t.Fatalf("encode png: %v", err)
	}
	path := writeTemp(t, "sample.png", buffer.Bytes())
	width, height := mediaDimensions(path, "image/png")
	if width != 40 || height != 24 {
		t.Fatalf("got %dx%d, want 40x24", width, height)
	}
}

func TestSVGDimensions(t *testing.T) {
	path := writeTemp(t, "sample.svg", []byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"></svg>`))
	width, height := mediaDimensions(path, "image/svg+xml")
	if width != 120 || height != 80 {
		t.Fatalf("got %dx%d, want 120x80", width, height)
	}

	literal := writeTemp(t, "sized.svg", []byte(`<svg width="64px" height="32px"></svg>`))
	width, height = mediaDimensions(literal, "image/svg+xml")
	if width != 64 || height != 32 {
		t.Fatalf("got %dx%d, want 64x32", width, height)
	}
}

func TestWebPDimensions(t *testing.T) {
	head := make([]byte, 32)
	copy(head[0:4], []byte("RIFF"))
	copy(head[8:12], []byte("WEBP"))
	copy(head[12:16], []byte("VP8X"))
	head[24] = 199 // width 200
	head[27] = 99  // height 100
	width, height := webpDimensions(head)
	if width != 200 || height != 100 {
		t.Fatalf("got %dx%d, want 200x100", width, height)
	}
}

func TestBMPDimensions(t *testing.T) {
	head := make([]byte, 30)
	copy(head[0:2], []byte("BM"))
	binary.LittleEndian.PutUint32(head[18:22], 128)
	binary.LittleEndian.PutUint32(head[22:26], uint32(4294967232)) // -64 as uint32
	width, height := bmpDimensions(head)
	if width != 128 || height != 64 {
		t.Fatalf("got %dx%d, want 128x64", width, height)
	}
}

func mp4Box(kind string, body []byte) []byte {
	out := make([]byte, 8+len(body))
	binary.BigEndian.PutUint32(out[:4], uint32(8+len(body)))
	copy(out[4:8], []byte(kind))
	copy(out[8:], body)
	return out
}

func TestMP4Dimensions(t *testing.T) {
	body := make([]byte, 84)
	binary.BigEndian.PutUint32(body[76:80], uint32(640)<<16)
	binary.BigEndian.PutUint32(body[80:84], uint32(360)<<16)

	movie := mp4Box("moov", mp4Box("trak", mp4Box("tkhd", body)))
	file := append(mp4Box("ftyp", []byte("isom0000")), movie...)
	path := writeTemp(t, "sample.mp4", file)

	width, height := mediaDimensions(path, "video/mp4")
	if width != 640 || height != 360 {
		t.Fatalf("got %dx%d, want 640x360", width, height)
	}
}

func TestAVIFDimensions(t *testing.T) {
	ispe := func(width, height uint32) []byte {
		body := make([]byte, 12)
		binary.BigEndian.PutUint32(body[4:8], width)
		binary.BigEndian.PutUint32(body[8:12], height)
		return mp4Box("ispe", body)
	}
	co := append(ispe(64, 64), ispe(800, 600)...)
	meta := mp4Box("meta", append(make([]byte, 4), mp4Box("iprp", mp4Box("ipco", co))...))
	file := append(mp4Box("ftyp", []byte("avif0000")), mp4Box("mdat", []byte("payload"))...)
	file = append(file, meta...)
	path := writeTemp(t, "sample.avif", file)

	width, height := mediaDimensions(path, "image/avif")
	if width != 800 || height != 600 {
		t.Fatalf("got %dx%d, want 800x600", width, height)
	}
}

func TestUnknownFileHasNoDimensions(t *testing.T) {
	path := writeTemp(t, "notes.txt", []byte("hello"))
	width, height := mediaDimensions(path, "text/plain")
	if width != 0 || height != 0 {
		t.Fatalf("got %dx%d, want 0x0", width, height)
	}
}
