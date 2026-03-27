package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.repository.LocationDao;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LocationCacheService {

    private final LocationDao locationDao;

    @Cacheable("locationNameMap")
    public Map<Integer, String> loadLocationNameMap() {
        return locationDao.findAll().stream()
                .collect(Collectors.toMap(l -> l.getId(), l -> l.getName(), (a, b) -> a));
    }
}
