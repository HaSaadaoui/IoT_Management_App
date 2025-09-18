package com.amaris.sensorprocessor.service;

import com.amaris.sensorprocessor.entity.LorawanSensorData;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.repository.SensorDao;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
public class SensorService {

    private final SensorDao sensorDao;                 // DAO JdbcTemplate
    private final SensorLorawanService lorawanService; // Intégration TTN

    /* READ */
    public List<Sensor> findAll() { return sensorDao.findAllSensors(); }
    public Optional<Sensor> findByIdSensor(String idSensor) { return sensorDao.findByIdOfSensor(idSensor); }
    public Sensor getOrThrow(String idSensor) {
        return findByIdSensor(idSensor).orElseThrow(() -> new IllegalArgumentException("Sensor not found: " + idSensor));
    }

    /* CREATE */
    @Transactional
    public Sensor create(Sensor toCreate) {
        if (toCreate.getIdSensor() == null || toCreate.getIdSensor().isBlank())
            throw new IllegalArgumentException("idSensor is required");

        if (sensorDao.findByIdOfSensor(toCreate.getIdSensor()).isPresent())
            throw new IllegalStateException("idSensor already exists: " + toCreate.getIdSensor());

        if (toCreate.getCommissioningDate() == null || toCreate.getCommissioningDate().isBlank())
            toCreate.setCommissioningDate(Instant.now().toString());

        if (toCreate.getStatus() == null) toCreate.setStatus(Boolean.TRUE);
        // 1) Insert BDD (transactionnel)
        int rows = sensorDao.insertSensor(toCreate);
        if (rows != 1) throw new IllegalStateException("DB insert failed for sensor " + toCreate.getIdSensor());
        log.info("[Sensor] DB created idSensor={}", toCreate.getIdSensor());

        // 2) Création TTN
        try {
            if (toCreate.getIdGateway() == null || toCreate.getIdGateway().isBlank()) {
                log.warn("[Sensor] No idGateway provided for {} → skipping TTN create", toCreate.getIdSensor());
            } else {
                LorawanSensorData lorawan = lorawanService.toLorawanCreate(toCreate);
                lorawanService.createDevice(toCreate.getIdGateway(), lorawan);
                log.info("[Sensor] TTN created device {} (app={}-app)", toCreate.getIdSensor(), toCreate.getIdGateway());
            }
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 409) {
                log.warn("[Sensor] TTN device {} already exists (409). Continue.", toCreate.getIdSensor());
            } else {
                log.error("[Sensor] TTN create failed for {}: {}", toCreate.getIdSensor(), e.getMessage(), e);
            }
        } catch (Exception e) {
            log.error("[Sensor] TTN create unexpected error for {}: {}", toCreate.getIdSensor(), e.getMessage(), e);
        }

        return sensorDao.findByIdOfSensor(toCreate.getIdSensor()).orElse(toCreate);
    }

    /* UPDATE */
    @Transactional
    public Sensor update(String idSensor, Sensor patch) {
        Sensor existing = getOrThrow(idSensor);

        // Pas de renommage d'ID
        if (patch.getIdSensor() != null && !patch.getIdSensor().isBlank()
                && !patch.getIdSensor().equals(existing.getIdSensor())) {
            throw new IllegalArgumentException("Renaming idSensor is not supported by current DAO");
        }

        // ⚠️ On n’édite QUE ces champs (DB-only)
        if (patch.getDeviceType() != null)        existing.setDeviceType(patch.getDeviceType());
        if (patch.getCommissioningDate() != null) existing.setCommissioningDate(patch.getCommissioningDate());
        if (patch.getFloor() != null)             existing.setFloor(patch.getFloor());
        if (patch.getLocation() != null)          existing.setLocation(patch.getLocation());

        // ❌ NE PAS toucher à : idGateway, frequencyPlan, buildingName, devEui, joinEui, appKey, status

        int rows = sensorDao.updateSensor(existing);
        if (rows != 1) throw new IllegalStateException("DB update failed for sensor " + idSensor);
        log.info("[Sensor] DB updated idSensor={} (DB-only, no TTN update)", idSensor);
        return existing;
    }


    /* DELETE  */
    @Transactional
    public void delete(String idSensor) {
        Sensor existing = getOrThrow(idSensor);

        try {
            lorawanService.deleteDevice(existing.getIdGateway(), idSensor);
            log.info("[Sensor] TTN deleted device {} (app={}-app)", idSensor, existing.getIdGateway());
        } catch (WebClientResponseException e) {
            if (e.getStatusCode().value() == 404) {
                // Déjà supprimé côté TTN : OK, on continue
                log.warn("[Sensor] TTN device {} not found in app {}-app (already deleted?)",
                        idSensor, existing.getIdGateway());
            } else {
                log.error("[Sensor] TTN delete failed for {} (app={}-app): {}",
                        idSensor, existing.getIdGateway(), e.getMessage());
            }
        } catch (Exception e) {
            log.error("[Sensor] TTN delete unexpected error for {}: {}", idSensor, e.getMessage(), e);
        }

        int rows = sensorDao.deleteByIdOfSensor(idSensor);
        if (rows == 0) throw new IllegalArgumentException("Sensor not found: " + idSensor);

        log.info("[Sensor] DB deleted idSensor={}", idSensor);
    }


    /* SET STATUS */
    @Transactional
    public Sensor setStatus(String idSensor, boolean active) {
        Sensor existing = getOrThrow(idSensor);
        existing.setStatus(active);

        int rows = sensorDao.updateSensor(existing);
        if (rows != 1) throw new IllegalStateException("DB update status failed for " + idSensor);

        return existing;
    }
}
