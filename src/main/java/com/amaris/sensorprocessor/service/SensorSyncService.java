package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.TtnDeviceInfo;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service pour synchroniser les sensors depuis TTN vers la DB locale
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SensorSyncService {

    private final SensorLorawanService lorawanService;
    private final SensorDao sensorDao;
    private final ObjectMapper objectMapper;
    private final GatewayService gatewayService;



    /**
     * Récupère tous les devices d'une gateway depuis TTN et retourne la liste
     * @param gatewayId ID de la gateway
     * @return Liste des devices TTN
     */
    public List<TtnDeviceInfo.EndDevice> fetchDevicesFromTTN(String gatewayId) {
        try {
            String json = lorawanService.fetchDevicesForGateway(gatewayId);
            TtnDeviceInfo response = objectMapper.readValue(json, TtnDeviceInfo.class);
            
            if (response.getEndDevices() != null) {
                log.info("[SensorSync] Fetched {} devices from TTN for gateway {}", 
                    response.getEndDevices().size(), gatewayId);
                return response.getEndDevices();
            }
            
            return new ArrayList<>();
        } catch (Exception e) {
            log.error("[SensorSync] Error fetching devices from TTN for gateway {}: {}", 
                gatewayId, e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    public String deduceFrequencyPlanFromGateway(String gatewayId, String deviceId) {
        try {
            Optional<Gateway> gateway = gatewayService.findById(gatewayId);
            if (gateway.isPresent()) {
                return gateway.get().getFrequencyPlan();
            } else {
                log.warn("[SensorSync] Gateway {} not found for device {}", gatewayId, deviceId);
                return null;
            }
        }
        catch (Exception e) {
            log.error("[SensorSync] Error deducing frequency plan for device {} from gateway {}: {}",
                deviceId, gatewayId, e.getMessage(), e);
            return null;
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    /**
     * Synchronise les sensors d'une gateway depuis TTN vers la DB locale
     * Crée les sensors manquants en DB
     * @param gatewayId ID de la gateway
     * @return Nombre de sensors synchronisés
     */
    @Transactional
    public int syncSensorsFromTTN(String gatewayId) {
        List<TtnDeviceInfo.EndDevice> ttnDevices = fetchDevicesFromTTN(gatewayId);
        int syncCount = 0;

        for (TtnDeviceInfo.EndDevice device : ttnDevices) {
            if (device.getIds() == null || device.getIds().getDeviceId() == null) {
                continue;
            }

            String deviceId = device.getIds().getDeviceId();
            
            // Vérifier si le sensor existe déjà en DB
            Optional<Sensor> existing = sensorDao.findByIdOfSensor(deviceId);
            
            if (existing.isEmpty()) {
                // Créer un nouveau sensor en DB
                Sensor newSensor = new Sensor();
                newSensor.setIdSensor(deviceId);
                newSensor.setIdGateway(gatewayId);
                newSensor.setStatus(true);
                newSensor.setCommissioningDate(
                    device.getCreatedAt() != null ? device.getCreatedAt() : Instant.now().toString()
                );
                        
                String devEui = device.getIds().getDevEui();
                if (devEui != null) {
                    newSensor.setDevEui(devEui);
                }

                String frequencyPlan = deduceFrequencyPlanFromGateway(gatewayId, deviceId);
                newSensor.setFrequencyPlan(frequencyPlan);

                // Utiliser DEV_EUI comme deviceType pour l'affichage seulement si l'on a pas pu détecter le deviceType
                newSensor.setDeviceType(devEui == null ? devEui : detectDeviceType(deviceId));
                
                // Définir building_name et floor selon la gateway
                if ("leva-rpi-mantu".equals(gatewayId)) {
                    newSensor.setBuildingName("Levallois-Building");
                    newSensor.setFloor(3);
                    newSensor.setLocation("Floor 3");
                } else if ("rpi-mantu".equals(gatewayId)) {
                    newSensor.setBuildingName("Châteaudun-Building");
                    newSensor.setFloor(2);
                    newSensor.setLocation("Floor 2");
                } else {
                    newSensor.setBuildingName("Unknown-Building");
                    newSensor.setFloor(1);
                    newSensor.setLocation("Floor 1");
                }
                
                try {
                    sensorDao.insertSensor(newSensor);
                    log.info("[SensorSync] Created sensor {} from TTN (DevEUI: {})", deviceId, devEui);
                    syncCount++;
                } catch (Exception e) {
                    log.error("[SensorSync] Failed to create sensor {} from TTN: {}", 
                        deviceId, e.getMessage());
                }
            }
        }

        log.info("[SensorSync] Synchronized {} sensors from TTN for gateway {}", 
            syncCount, gatewayId);
        return syncCount;
    }

    /**
     * Détecte le type de device depuis son ID
     * Exemples: desk-03-01 → DESK, co2-03-01 → CO2, etc.
     */
    private String detectDeviceType(String deviceId) {
        if (deviceId == null) return "GENERIC";
        
        String lower = deviceId.toLowerCase();
        if (lower.startsWith("desk")) return "DESK";
        if (lower.startsWith("co2")) return "CO2";
        if (lower.startsWith("occup")) return "OCCUP";
        if (lower.startsWith("pir")) return "PIR_LIGHT";
        if (lower.startsWith("tempex")) return "TEMPEX";
        if (lower.startsWith("son")) return "SON";
        if (lower.startsWith("eye")) return "EYE";
        if (lower.startsWith("count")) return "COUNT";
        
        return "GENERIC";
    }

    /**
     * Compare les sensors en DB avec ceux de TTN et retourne les différences
     * @param gatewayId ID de la gateway
     * @return Rapport de synchronisation
     */
    public SyncReport compareWithTTN(String gatewayId) {
        List<TtnDeviceInfo.EndDevice> ttnDevices = fetchDevicesFromTTN(gatewayId);
        List<Sensor> dbSensors = sensorDao.findAllSensors().stream()
            .filter(s -> gatewayId.equals(s.getIdGateway()))
            .collect(Collectors.toList());

        SyncReport report = new SyncReport();
        report.setGatewayId(gatewayId);
        report.setTtnDeviceCount(ttnDevices.size());
        report.setDbSensorCount(dbSensors.size());

        // Devices dans TTN mais pas en DB
        List<String> ttnDeviceIds = ttnDevices.stream()
            .filter(d -> d.getIds() != null && d.getIds().getDeviceId() != null)
            .map(d -> d.getIds().getDeviceId())
            .collect(Collectors.toList());

        List<String> dbSensorIds = dbSensors.stream()
            .map(Sensor::getIdSensor)
            .collect(Collectors.toList());

        report.setMissingInDb(ttnDeviceIds.stream()
            .filter(id -> !dbSensorIds.contains(id))
            .collect(Collectors.toList()));

        report.setMissingInTtn(dbSensorIds.stream()
            .filter(id -> !ttnDeviceIds.contains(id))
            .collect(Collectors.toList()));

        return report;
    }

    /**
     * Rapport de synchronisation
     */
    @lombok.Data
    public static class SyncReport {
        private String gatewayId;
        private int ttnDeviceCount;
        private int dbSensorCount;
        private List<String> missingInDb;
        private List<String> missingInTtn;
    }
}
