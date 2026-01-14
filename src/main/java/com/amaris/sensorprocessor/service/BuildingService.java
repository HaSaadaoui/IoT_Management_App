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
     * Dossier des SVG des bâtiments.
     *
     * Physiquement :
     *   <racine du projet>/uploads/buildings
     *
     * Accessible via HTTP (grâce au WebConfig) :
     *   /uploads/buildings/xxx.svg
     */
    private final Path uploadRoot = Paths.get("uploads", "buildings");

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
            // On récupère le building pour obtenir le chemin du SVG
            Optional<Building> buildingOpt = buildingDao.findBuildingById(id);
            if (buildingOpt.isPresent()) {
                Building building = buildingOpt.get();
                String svgPath = building.getSvgPlan();
                if (svgPath != null && !svgPath.isBlank()) {
                    // Le chemin public est de la forme /uploads/buildings/xxx.svg
                    // On doit le convertir en chemin physique
                    String filename = Paths.get(svgPath).getFileName().toString();
                    Path fileOnDisk = uploadRoot.resolve(filename);
                    try {
                        Files.deleteIfExists(fileOnDisk);
                    } catch (IOException ioEx) {
                        if (bindingResult != null) {
                            bindingResult.reject("svg.empty", "Impossible de supprimer le fichier SVG");
                        }
                    }
                }
                buildingDao.deleteBuildingById(id);
            } else {
                if (bindingResult != null) {
                    bindingResult.reject("building.notFound", "Building introuvable");
                }
            }

        } catch (Exception e) {
            // TODO: logger + bindingResult.reject(...)
        }
    }

    /**
     * Crée un Building + sauvegarde le SVG dans :
     *   uploads/buildings
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

        // 2) Créer le dossier uploads/buildings si besoin
        Files.createDirectories(uploadRoot);

        Path target = uploadRoot.resolve(cleanFilename);

        // 3) Copier le fichier sur disque
        try (InputStream in = svgFile.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }

        // 4) Chemin "public" (URL) stocké en base
        // /uploads/** -> file:uploads/ (déjà défini dans WebConfig)
        String publicSvgPath = "/uploads/buildings/" + cleanFilename;

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
    
    /**
     * Met à jour un Building + sauvegarde le SVG dans :
     *   uploads/buildings
     */
    public Building updateBuildingWithSvg(Integer id,
                                          String name,
                                          int floors,
                                          double scale,
                                          MultipartFile svgFile,
                                          BindingResult bindingResult) throws IOException {

        // 1) Sécuriser le nom de fichier
        String originalFilename = svgFile.getOriginalFilename();
        String cleanFilename = (originalFilename == null || originalFilename.isBlank())
                ? "building.svg"
                : originalFilename.replaceAll("[^a-zA-Z0-9._-]", "_");

        // 2) Créer le dossier uploads/buildings si besoin
        Files.createDirectories(uploadRoot);

        Path target = uploadRoot.resolve(cleanFilename);

        // 3) Copier le fichier sur disque
        try (InputStream in = svgFile.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        }

        // 4) Chemin "public" (URL) stocké en base
        // /uploads/** -> file:uploads/ (déjà défini dans WebConfig)
        String publicSvgPath = "/uploads/buildings/" + cleanFilename;

        // 5) Récupérer l'ancien Building pour connaître l'ancien fichier
        Building oldBuilding = buildingDao.findBuildingById(id).orElse(null);
        String oldSvgPath = oldBuilding != null ? oldBuilding.getSvgPlan() : null;

        // 6) Construire l'entité Building
        Building building = new Building();
        building.setId(id);
        building.setName(name);
        building.setFloorsCount(floors);
        building.setScale(scale);
        building.setSvgPlan(publicSvgPath);

        // 7) Persister en base
        try {
            buildingDao.updateBuilding(building);
            // ✅ Si mise à jour OK, supprimer l'ancien fichier SVG
            if (oldSvgPath != null && !oldSvgPath.isBlank() && !oldSvgPath.equals(publicSvgPath)) {
                Path oldFile = uploadRoot.resolve(Paths.get(oldSvgPath).getFileName());
                try {
                    Files.deleteIfExists(oldFile);
                } catch (IOException e) {
                    // TODO: logger mais ne pas écraser l'exception principale
                }
            }
        } catch (Exception e) {
            throw e;
        }

        return building;
    }

    /**
     * Met à jour un Building sans modifier le SVG
     */
    public Building updateBuildingWithoutSvg(Integer id,
                                          String name,
                                          int floors,
                                          double scale,
                                          BindingResult bindingResult) throws IOException {

        // Construire l'entité Building
        Building building = new Building();
        building.setId(id);
        building.setName(name);
        building.setFloorsCount(floors);
        building.setScale(scale);

        // Persister en base
        try {
            buildingDao.updateBuildingWithoutSVG(building);
        } catch (Exception e) {
            throw e;
        }

        return building;
    }
}
