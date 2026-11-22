package handlers

import "github.com/gin-gonic/gin"

// formValue mengambil nilai field form/multipart dan memberi tahu apakah field dikirim.
func formValue(c *gin.Context, key string) (string, bool) {
	_ = c.PostForm(key)
	if c.Request.MultipartForm == nil {
		return "", false
	}
	values, exists := c.Request.MultipartForm.Value[key]
	if !exists || len(values) == 0 {
		return "", false
	}
	return values[0], true
}
