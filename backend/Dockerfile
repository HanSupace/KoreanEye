FROM gradle:8.14.3-jdk21 AS build
WORKDIR /workspace/backend
COPY backend .
COPY frontend/lib/profanity-policy.json /workspace/frontend/lib/profanity-policy.json
RUN gradle bootJar --no-daemon

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /workspace/backend/build/libs/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
