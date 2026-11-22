# Build context: folder backend/
FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S app \
    && adduser -S -G app app
WORKDIR /app
COPY --from=build /out/server ./server
RUN mkdir -p uploads && chown -R app:app /app
USER app
ENV APP_ENV=production \
    APP_PORT=8080 \
    UPLOAD_DIR=./uploads
EXPOSE 8080
CMD ["./server"]
