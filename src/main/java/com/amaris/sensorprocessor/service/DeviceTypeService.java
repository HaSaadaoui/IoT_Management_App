package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.DeviceType;
import com.amaris.sensorprocessor.repository.DeviceTypeDao;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DeviceTypeService {

    private final DeviceTypeDao deviceTypeDao;

    public List<DeviceType> findAll() {
        return deviceTypeDao.findAll();
    }

    public Optional<DeviceType> findById(Integer id) {
        return deviceTypeDao.findById(id);
    }

    public Optional<DeviceType> findByLabel(String label) {
        return deviceTypeDao.findByLabel(label);
    }

    public void deleteById(Integer id) {
        deviceTypeDao.deleteById(id);
    }

    public DeviceType updateLabel(Integer id, String label) {
        int updated = deviceTypeDao.update(id, label.trim().toUpperCase());
        if (updated == 0) throw new IllegalArgumentException("Device type not found: " + id);
        return deviceTypeDao.findById(id).orElseThrow();
    }

    public DeviceType createByLabel(String label) {
        return deviceTypeDao.insert(label);
    }
}
