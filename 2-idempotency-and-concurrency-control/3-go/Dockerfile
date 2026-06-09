# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY main.go ./
RUN go mod tidy && CGO_ENABLED=0 go build -o checkout-service .

# ---- Runtime stage ----
FROM alpine:3.20 AS runtime
WORKDIR /app
COPY --from=build /app/checkout-service ./checkout-service
EXPOSE 3031
CMD ["./checkout-service"]
