FROM golang:1.22-alpine as builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o gridlock-server ./cmd/server/main.go

FROM alpine:latest

WORKDIR /root/

COPY --from=builder /app/gridlock-server .

EXPOSE 8080

CMD ["./gridlock-server"]

