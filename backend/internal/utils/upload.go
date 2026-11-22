package utils

import (
	"bytes"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// StorageSettings dipilih lewat STORAGE_DRIVER.
//   - local: file disimpan di UPLOAD_DIR dan dilayani Gin/Nginx di /uploads.
//   - cloudinary: file dikirim ke Cloudinary, URL absolut yang dikembalikan
//     disimpan di database. Cocok untuk Render/Fly.io yang filesystem-nya
//     tidak persisten (file lokal hilang saat service restart/deploy).
type StorageSettings struct {
	Driver         string
	CloudName      string
	CloudAPIKey    string
	CloudAPISecret string
	CloudFolder    string
}

var storage StorageSettings

// ConfigureStorage dipanggil sekali saat startup.
func ConfigureStorage(s StorageSettings) { storage = s }

var imageSignatures = []struct {
	prefix []byte
	ext    string
}{
	{[]byte{0xFF, 0xD8, 0xFF}, ".jpg"},                               // JPEG
	{[]byte{0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A}, ".png"}, // PNG
	{[]byte("GIF87a"), ".gif"},
	{[]byte("GIF89a"), ".gif"},
}

func detectImageExt(head []byte) string {
	for _, signature := range imageSignatures {
		if bytes.HasPrefix(head, signature.prefix) {
			return signature.ext
		}
	}
	// WEBP: "RIFF"...."WEBP"
	if len(head) >= 12 && bytes.Equal(head[:4], []byte("RIFF")) && bytes.Equal(head[8:12], []byte("WEBP")) {
		return ".webp"
	}
	return ""
}

// SaveImage menyimpan file gambar dengan validasi magic bytes.
// Mengembalikan (url, disediakan, error). SVG sengaja ditolak karena risiko XSS.
func SaveImage(c *gin.Context, field, subdir, uploadRoot string, maxBytes int64) (string, bool, error) {
	fileHeader, err := c.FormFile(field)
	if err == http.ErrMissingFile {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	if fileHeader.Size > maxBytes {
		return "", true, fmt.Errorf("ukuran gambar melebihi batas %d MB", maxBytes>>20)
	}

	file, err := fileHeader.Open()
	if err != nil {
		return "", true, err
	}
	defer file.Close()

	head := make([]byte, 512)
	n, err := io.ReadFull(file, head)
	if err != nil && err != io.ErrUnexpectedEOF && err != io.EOF {
		return "", true, err
	}

	ext := detectImageExt(head[:n])
	if ext == "" {
		return "", true, fmt.Errorf("format gambar tidak didukung; gunakan JPG, PNG, GIF, atau WEBP")
	}
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		return "", true, err
	}

	data, err := io.ReadAll(io.LimitReader(file, maxBytes+1))
	if err != nil {
		return "", true, err
	}
	if int64(len(data)) > maxBytes {
		return "", true, fmt.Errorf("ukuran gambar melebihi batas")
	}

	folder := cleanSubdir(subdir)
	if storage.Driver == "cloudinary" {
		imageURL, err := cloudinaryUpload(data, ext, folder)
		return imageURL, true, err
	}

	dir := filepath.Join(uploadRoot, folder)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", true, err
	}

	name := uuid.NewString() + ext
	target := filepath.Join(dir, name)
	out, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return "", true, err
	}
	if _, err := out.Write(data); err != nil {
		_ = out.Close()
		_ = os.Remove(target)
		return "", true, err
	}
	if err := out.Close(); err != nil {
		_ = os.Remove(target)
		return "", true, err
	}

	return "/uploads/" + folder + "/" + name, true, nil
}

// DeleteImage menghapus file gambar lama dengan aman (tidak boleh keluar dari uploadRoot).
func DeleteImage(uploadRoot, url string) error {
	if url == "" {
		return nil
	}
	if storage.Driver == "cloudinary" {
		publicID := cloudinaryPublicID(url)
		if publicID == "" {
			return fmt.Errorf("URL gambar tidak dikenal")
		}
		return cloudinaryDestroy(publicID)
	}

	rel := strings.TrimPrefix(url, "/uploads/")
	rel = filepath.Clean(rel)
	if rel == "." || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) || filepath.IsAbs(rel) {
		return fmt.Errorf("path gambar tidak valid")
	}
	return os.Remove(filepath.Join(uploadRoot, rel))
}

func cleanSubdir(subdir string) string {
	subdir = strings.Trim(strings.ReplaceAll(subdir, "\\", "/"), "/")
	if subdir == "" || strings.Contains(subdir, "..") {
		return "misc"
	}
	return subdir
}

// ---------------------------------------------------------------------------
// Cloudinary
// ---------------------------------------------------------------------------

var cloudinaryHTTP = &http.Client{Timeout: 30 * time.Second}

func cloudinaryUpload(data []byte, ext, subdir string) (string, error) {
	folder := storage.CloudFolder
	if subdir != "" {
		folder = strings.Trim(folder+"/"+subdir, "/")
	}
	publicID := uuid.NewString()
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := cloudinarySignature(map[string]string{
		"folder":    folder,
		"public_id": publicID,
		"timestamp": timestamp,
	})

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	fields := []struct{ key, value string }{
		{"api_key", storage.CloudAPIKey},
		{"timestamp", timestamp},
		{"signature", signature},
		{"folder", folder},
		{"public_id", publicID},
	}
	for _, field := range fields {
		if err := writer.WriteField(field.key, field.value); err != nil {
			return "", err
		}
	}
	part, err := writer.CreateFormFile("file", publicID+ext)
	if err != nil {
		return "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}

	endpoint := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/upload", url.PathEscape(storage.CloudName))
	req, err := http.NewRequest(http.MethodPost, endpoint, &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := cloudinaryHTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("Cloudinary menolak upload (status %d)", resp.StatusCode)
	}
	var result struct {
		SecureURL string `json:"secure_url"`
	}
	if err := json.Unmarshal(body, &result); err != nil || result.SecureURL == "" {
		return "", fmt.Errorf("respons Cloudinary tidak valid")
	}
	return result.SecureURL, nil
}

func cloudinaryDestroy(publicID string) error {
	timestamp := strconv.FormatInt(time.Now().Unix(), 10)
	signature := cloudinarySignature(map[string]string{
		"public_id": publicID,
		"timestamp": timestamp,
	})
	form := url.Values{
		"api_key":   {storage.CloudAPIKey},
		"timestamp": {timestamp},
		"signature": {signature},
		"public_id": {publicID},
	}
	endpoint := fmt.Sprintf("https://api.cloudinary.com/v1_1/%s/image/destroy", url.PathEscape(storage.CloudName))
	resp, err := cloudinaryHTTP.PostForm(endpoint, form)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("Cloudinary gagal menghapus gambar (status %d)", resp.StatusCode)
	}
	return nil
}

// cloudinarySignature mengikuti aturan Cloudinary: semua parameter kecuali
// file, cloud_name, resource_type, dan api_key diurutkan alphabetically lalu
// diikuti API secret, kemudian di-SHA1.
func cloudinarySignature(params map[string]string) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	var builder strings.Builder
	for index, key := range keys {
		if index > 0 {
			builder.WriteByte('&')
		}
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(params[key])
	}
	builder.WriteString(storage.CloudAPISecret)
	sum := sha1.Sum([]byte(builder.String()))
	return hex.EncodeToString(sum[:])
}

// cloudinaryPublicID mengubah https://res.cloudinary.com/<cloud>/image/upload/v123/folder/name.jpg
// menjadi "folder/name" untuk keperluan destroy.
func cloudinaryPublicID(raw string) string {
	parsed, err := url.Parse(raw)
	host := strings.ToLower(parsed.Host)
	if err != nil || !(host == "res.cloudinary.com" || strings.HasSuffix(host, ".cloudinary.com")) {
		return ""
	}
	const marker = "/image/upload/"
	index := strings.Index(parsed.Path, marker)
	if index < 0 {
		return ""
	}
	path := parsed.Path[index+len(marker):]
	if strings.HasPrefix(path, "v") {
		if slash := strings.Index(path, "/"); slash > 0 {
			if _, err := strconv.Atoi(path[1:slash]); err == nil {
				path = path[slash+1:]
			}
		}
	}
	if dot := strings.LastIndex(path, "."); dot > 0 {
		path = path[:dot]
	}
	return strings.Trim(path, "/")
}
