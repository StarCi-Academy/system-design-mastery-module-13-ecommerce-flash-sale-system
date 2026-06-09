# ---- Build stage ----
FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY *.go ./
# Resolve dependencies and generate go.sum, then build a static binary.
RUN go mod tidy
RUN CGO_ENABLED=0 go build -o /waiting-room .

# ---- Runtime stage ----
FROM alpine:3.20 AS runtime
WORKDIR /app
COPY --from=build /waiting-room /app/waiting-room
EXPOSE 3030
CMD ["/app/waiting-room"]
