package main

import (
	"os"
	"strconv"
	"time"
)

// Config holds all runtime configuration read once from the environment.
// Keeping env reads in one place avoids scattering os.Getenv across handlers.
type Config struct {
	Port         string
	RedisHost    string
	RedisPort    int
	AdmittedTTL  time.Duration
}

func getEnv(key, fallback string) string {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v, ok := os.LookupEnv(key); ok && v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

// LoadConfig builds a Config from environment variables with safe defaults.
func LoadConfig() *Config {
	return &Config{
		Port:        getEnv("PORT", "3030"),
		RedisHost:   getEnv("REDIS_HOST", "localhost"),
		RedisPort:   getEnvInt("REDIS_PORT", 6379),
		AdmittedTTL: time.Duration(getEnvInt("ADMITTED_TTL_SEC", 300)) * time.Second,
	}
}
