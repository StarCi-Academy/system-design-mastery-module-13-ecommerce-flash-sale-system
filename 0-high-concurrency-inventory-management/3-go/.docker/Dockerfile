# Multi-stage build for the Go inventory-service.
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
RUN go mod download
COPY main.go ./
# Resolve indirect deps and build a static binary.
RUN go mod tidy && CGO_ENABLED=0 go build -o /inventory-service .

FROM alpine:3.20 AS runtime
WORKDIR /app
COPY --from=build /inventory-service /inventory-service
EXPOSE 3029
CMD ["/inventory-service"]
