package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Building;
import com.amaris.sensorprocessor.repository.BuildingDao;
import org.springframework.stereotype.Service;
import org.springframework.validation.BindingResult;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
public class BuildingService {

    private final BuildingDao buildingDao;

    /**
     * Dossier des SVG dans les ressources statiques.
     *
     * Physiquement (en dev) :
     *   src/main/resources/static/image/upload/building
     *
     * Accessible via HTTP :
     *   /image/upload/building/xxx.svg
     */
    private final Path uploadRoot = Paths.get(
            "src", "main", "resources", "static", "image", "upload", "building"
    );

    public BuildingService(BuildingDao buildingDao) {
        this.buildingDao = buildingDao;
    }

    public List<Building> getAllBuildings() {
        try {
            return buildingDao.findAllBuildings();
        } catch (Exception e) {
            // TODO: logger proprement
            return Collections.emptyList();
        }
    }

    public Optional<Building> findById(Integer id) {
        try {
            return buildingDao.findBuildingById(id);
        } catch (Exception e) {
            // TODO: logger
            return Optional.empty();
        }
    }

    public void saveBuildingInDatabase(Building building, BindingResult bindingResult) {
        try {
            buildingDao.insertBuilding(building);
        } catch (Exception e) {
            // TODO: logger + bindingResult.reject(...)
        }
    }

    public void updateBuildingInDatabase(Building building, BindingResult bindingResult) {
        try {
            int rows = buildingDao.updateBuilding(building);
            if (rows == 0) {
                // TODO: bindingResult.reject("building.notFound", "Building introuvable");
            }
        } catch (Exception e) {
            // TODO: logger + bindingResult.reject(...)
        }
    }

    public void deleteBuildingInDatabase(Integer id, BindingResult bindingResult) {
        try {
            int rows = buildingDao.deleteBuildingById(id);
            if (rows == 0) {
                // TODO: bindingResult.reject("building.notFound", "Building introuvable");
            }
        } catch (Exception e) {
            // TODO: logger + bindingResult.reject(...)
        }
    }

    /**
     * Crée un Building + sauvegarde le SVG dans
     * src/main/resources/static/image/upload/building
     */
    public Building createBuildingWithSvg(String name,
                                          int floors,
                                          double scale,
                                          MultipartFile svgFile,
                                          BindingResult bindingResult) throws IOException {

        if (svgFile == null || svgFile.isEmpty()) {
            if (bindingResult != null) {
                bindingResult.reject("svg.empty", "Le fichier SVG est vide");
            }
            throw new IllegalArgumentException("SVG file is empty");
        }

        // 1) Sécuriser le nom de fichier
        String originalFilename = svgFile.getOriginalFilename();
        String cleanFilename = (originalFilename == null || originalFilename.isBlank())
                ? "building.svg"
                : originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");

        // 2) Créer le dossier src/main/resources/static/image/upload/building si besoin
        Files.createDirectories(uploadRoot);

        Path target = uploadRoot.resolve(cleanFilename);

        // 3) Copier le fichier sur disque
        try (InputStream in = svgFile.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }

        // 4) Chemin "public" (URL) stocké en base
        // /image/** -> classpath:/static/image/ (déjà défini dans WebConfig)
        String publicSvgPath = "/image/upload/building/" + cleanFilename;

        // 5) Construire l'entité Building
        Building building = new Building();
        building.setName(name);
        building.setFloorsCount(floors);
        building.setScale(scale);
        building.setSvgPlan(publicSvgPath);

        // 6) Persister en base
        try {
            buildingDao.insertBuilding(building);
        } catch (Exception e) {
            // en cas d'erreur DB, on essaie de supprimer le fichier
            try {
                Files.deleteIfExists(target);
            } catch (IOException ioEx) {
                // TODO: logger mais ne pas écraser l'exception principale
            }
            throw e;
        }

        return building;
    }
}
