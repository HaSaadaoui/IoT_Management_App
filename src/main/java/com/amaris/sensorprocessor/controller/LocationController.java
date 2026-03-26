package com.amaris.sensorprocessor.controller;

import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.Location;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.repository.GatewayDao;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.service.LocationService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/locations")
public class LocationController {

    private final LocationService locationService;
    private final GatewayDao gatewayDao;
    private final SensorDao sensorDao;

    public LocationController(LocationService locationService, GatewayDao gatewayDao, SensorDao sensorDao) {
        this.locationService = locationService;
        this.gatewayDao = gatewayDao;
        this.sensorDao = sensorDao;
    }

    @GetMapping
    public ResponseEntity<List<Location>> getAll() {
        return ResponseEntity.ok(locationService.findAll());
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable Integer id) {
        return locationService.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Location location) {
        try {
            return ResponseEntity.status(HttpStatus.CREATED).body(locationService.create(location));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable Integer id, @RequestBody Location location) {
        try {
            return ResponseEntity.ok(locationService.update(id, location));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable Integer id) {
        try {
            locationService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/{id}/check-delete")
    public ResponseEntity<?> checkDelete(@PathVariable Integer id) {
        List<Gateway> gateways = gatewayDao.findByLocationId(id);
        List<Sensor> sensors = sensorDao.findAllByLocationId(id);
        boolean canDelete = gateways.isEmpty() && sensors.isEmpty();
        return ResponseEntity.ok(Map.of(
                "canDelete", canDelete,
                "gateways", gateways,
                "sensors", sensors
        ));
    }
}
