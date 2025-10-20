### for linux/amd64 ### Windows 11
FROM openjdk:17-jdk@sha256:98f0304b3a3b7c12ce641177a99d1f3be56f532473a528fda38d53d519cafb13

### Définir le répertoire de travail ###
WORKDIR /opt/app

### Copier le fichier JAR dans le conteneur ###
COPY target/sensorprocessor-0.0.1-SNAPSHOT.jar /sensorprocessor.jar

### Exposer le port de l'application (si nécessaire) ###
EXPOSE 8080

### Chemin vers le fichier de configuration (important pour la base de données)
ENV SPRING_CONFIG_LOCATION=/opt/app/config

### Commande pour démarrer l'application ###
CMD ["java", "-jar", "/sensorprocessor.jar", "--spring.config.additional-location=${SPRING_CONFIG_LOCATION}"]
