package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.Building;
import com.amaris.sensorprocessor.service.BuildingService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/buildings")
public class BuildingController {

    private final BuildingService buildingService;

    public BuildingController(BuildingService buildingService) {
        this.buildingService = buildingService;
    }

    @PostMapping(consumes = {"multipart/form-data"})
    public ResponseEntity<Building> createBuilding(
            @RequestParam("name") String name,
            @RequestParam("floors") int floors,
            @RequestParam("scale") double scale,
            @RequestParam("svgFile") MultipartFile svgFile
    ) throws Exception {

        // BindingResult pour éventuelles erreurs
        BindingResult bindingResult = new BeanPropertyBindingResult(
                new Object(), // target "bidon", on s'en sert juste comme collecteur d'erreurs
                "building"
        );

        // 👉 On délègue toute la logique (copie + DB) au service
        Building building = buildingService.createBuildingWithSvg(
                name,
                floors,
                scale,
                svgFile,
                bindingResult
        );

        if (bindingResult.hasErrors()) {
            // Option : renvoyer les messages d'erreur dans le body
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(building);
    }

    @PostMapping(path = "/{id}", consumes = {"multipart/form-data"})
    public ResponseEntity<Building> updateBuilding(
            @PathVariable Integer id,
            @RequestParam("name") String name,
            @RequestParam("floors") int floors,
            @RequestParam("scale") double scale,
            @RequestParam("svgFile") MultipartFile svgFile
    ) throws Exception {

        // BindingResult pour éventuelles erreurs
        BindingResult bindingResult = new BeanPropertyBindingResult(
                new Object(),
                "building"
        );

        Building building;

        if (svgFile != null && !svgFile.isEmpty()) {
            // Mise à jour avec nouveau SVG
            building = buildingService.updateBuildingWithSvg(
                    id,
                    name,
                    floors,
                    scale,
                    svgFile,
                    bindingResult
            );
        } else {
            // Mise à jour sans modifier le SVG
            building = buildingService.updateBuildingWithoutSvg(
                    id,
                    name,
                    floors,
                    scale,
                    bindingResult
            );
        }

        if (bindingResult.hasErrors()) {
            // Option : renvoyer les messages d'erreur dans le body
            return ResponseEntity.badRequest().build();
        }

        return ResponseEntity.ok(building);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Building> getBuilding(@PathVariable Integer id) {
        return buildingService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    @ResponseBody
    public ResponseEntity<?> deleteBuilding(@PathVariable Integer id) {

        BindingResult bindingResult = new BeanPropertyBindingResult(
                new Object(),
                "building"
        );
        buildingService.deleteBuildingInDatabase(id, bindingResult);
        if (bindingResult.hasErrors()) {
            // Option : renvoyer les messages d'erreur dans le body
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok().body(Map.of("message", "Building deleted successfully"));
    }

    @GetMapping
    public ResponseEntity<List<Building>> listBuildings() {
        return ResponseEntity.ok(buildingService.getAllBuildings());
    }

    @GetMapping("/csrf-token")
    public Map<String, String> csrfToken(CsrfToken token) {
        return Map.of(
                "parameterName", token.getParameterName(),
                "headerName", token.getHeaderName(),
                "token", token.getToken()
        );
    }
}
