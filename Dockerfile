FROM amazoncorretto:17-alpine

### Définir le répertoire de travail ###
WORKDIR /opt/app

# Copy source code
COPY . .

# Run Maven and skip tests
RUN chmod +x mvnw && ./mvnw clean install -DskipTests

### Copier le fichier JAR dans le conteneur ###
COPY ./target/sensorprocessor-0.0.1-SNAPSHOT.jar /sensorprocessor.jar

### Exposer le port de l'application (si nécessaire) ###
EXPOSE 8080

### Commande pour démarrer l'application ###
CMD ["java", "-jar", "/sensorprocessor.jar"]
