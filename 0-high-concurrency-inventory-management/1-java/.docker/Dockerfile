# Multi-stage build for the Spring Boot inventory-service.
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml ./
RUN mvn -q -e dependency:go-offline
COPY src ./src
RUN mvn -q -e -DskipTests package

FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app
COPY --from=build /app/target/inventory-service-1.0.0.jar app.jar
EXPOSE 3029
CMD ["java", "-jar", "app.jar"]
