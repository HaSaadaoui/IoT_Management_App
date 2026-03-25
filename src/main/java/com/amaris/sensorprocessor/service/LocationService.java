package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Location;
import com.amaris.sensorprocessor.repository.LocationDao;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

@Service
public class LocationService {

    private final LocationDao locationDao;

    public LocationService(LocationDao locationDao) {
        this.locationDao = locationDao;
    }

    public List<Location> findAll() {
        try {
            return locationDao.findAll();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    public Optional<Location> findById(Integer id) {
        try {
            return locationDao.findById(id);
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    public List<Location> findByBuilding(Integer buildingId) {
        try {
            return locationDao.findByBuilding(buildingId);
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    public List<Location> findByBuildingAndFloor(Integer buildingId, Integer floor) {
        try {
            return locationDao.findByBuildingAndFloor(buildingId, floor);
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    public Location create(Location location) {
        if (location.getName() == null || location.getName().isBlank())
            throw new IllegalArgumentException("Location name is required");
        locationDao.insert(location);
        return location;
    }

    public Location update(Integer id, Location location) {
        locationDao.findById(id).orElseThrow(() -> new IllegalArgumentException("Location not found: " + id));
        location.setId(id);
        locationDao.update(location);
        return location;
    }

    public void delete(Integer id) {
        int rows = locationDao.deleteById(id);
        if (rows == 0) throw new IllegalArgumentException("Location not found: " + id);
    }
}
