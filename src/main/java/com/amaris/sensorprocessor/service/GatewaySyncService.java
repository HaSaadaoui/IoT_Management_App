package com.amaris.sensorprocessor.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Arrays;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.Optional;
import java.util.EnumMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amaris.sensorprocessor.entity.DeviceType;
import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.PayloadValueType;
import com.amaris.sensorprocessor.entity.Sensor;
import com.amaris.sensorprocessor.entity.SensorData;
import com.amaris.sensorprocessor.entity.TtnDeviceInfo;
import com.amaris.sensorprocessor.repository.SensorDao;
import com.amaris.sensorprocessor.repository.SensorDataDao;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.Configuration;
import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.JsonPath;
import com.jayway.jsonpath.Option;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import static com.amaris.sensorprocessor.constant.Constants.SENSOR_DATA_SYNC_PERIOD_MINUTE;
import static com.amaris.sensorprocessor.constant.Constants.SENSOR_DATA_SYNC_ROLLBACK_TIME_MINUTE;

@Slf4j
@Service
@RequiredArgsConstructor
public class GatewaySyncService {

    private final SensorLorawanService lorawanService;
    private final SensorService sensorService;
    private final SensorDataDao sensorDataDao;
    private final SensorDao sensorDao;
    private final ObjectMapper objectMapper;
    private final GatewayService gatewayService;
    private final DeviceTypeService deviceTypeService; // ✅ AJOUT

    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(1);
    private final Map<String, ScheduledFuture<?>> scheduledSyncTasks = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> initialSyncCompleted = new ConcurrentHashMap<>();

    private static final java.util.Set<PayloadValueType> ALLOWED_TYPES = PayloadValueType.BUSINESS_TYPES;

    private static final Map<PayloadValueType, String> JSON_PATH_MAP;

    static {
        JSON_PATH_MAP = Arrays.stream(PayloadValueType.values())
                .filter(e -> e.getJsonPath() != null)
                .collect(Collectors.toMap(
                        e -> e,
                        PayloadValueType::getJsonPath,
                        (v1, v2) -> v2,
                        () -> new EnumMap<>(PayloadValueType.class)
                ));
    }

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
        } catch (Exception e) {
            log.error("[SensorSync] Error deducing frequency plan for device {} from gateway {}: {}",
                    deviceId, gatewayId, e.getMessage(), e);
            return null;
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    @Transactional
    public int syncSensorsFromTTN(String gatewayId) {
        List<TtnDeviceInfo.EndDevice> ttnDevices = fetchDevicesFromTTN(gatewayId);

        // ✅ Charger tous les device types en une seule requête
        Map<String, Integer> deviceTypeCodeToId = deviceTypeService.findAll().stream()
                .collect(Collectors.toMap(
                        dt -> {
                            String typeName = dt.getTypeName();
                            String fallback = dt.getLabel();
                            return (typeName != null && !typeName.isBlank() ? typeName : fallback).toUpperCase();
                        },
                        DeviceType::getIdDeviceType
                ));

        int syncCount = 0;

        for (TtnDeviceInfo.EndDevice device : ttnDevices) {
            if (device.getIds() == null || device.getIds().getDeviceId() == null) continue;

            String deviceId = device.getIds().getDeviceId();
            Optional<Sensor> existing = sensorDao.findByIdOfSensor(deviceId);

            if (existing.isEmpty()) {
                Sensor newSensor = new Sensor();
                newSensor.setIdSensor(deviceId);
                newSensor.setIdGateway(gatewayId);
                newSensor.setStatus(true);
                newSensor.setCommissioningDate(
                        device.getCreatedAt() != null ? device.getCreatedAt() : Instant.now().toString()
                );

                String devEui = device.getIds().getDevEui();
                if (devEui != null) newSensor.setDevEui(devEui);

                String frequencyPlan = deduceFrequencyPlanFromGateway(gatewayId, deviceId);
                newSensor.setFrequencyPlan(frequencyPlan);

                // ✅ Résoudre le label en idDeviceType
                String detectedLabel = detectDeviceType(deviceId);
                String resolvedLabel = ("GENERIC".equals(detectedLabel) && devEui != null)
                        ? "GENERIC"
                        : detectedLabel;

                Integer idDeviceType = deviceTypeCodeToId.get(resolvedLabel.toUpperCase());
                if (idDeviceType == null) {
                    // Fallback sur GENERIC si le label n'existe pas en DB
                    idDeviceType = deviceTypeCodeToId.get("GENERIC");
                    log.warn("[SensorSync] DeviceType '{}' not found in DB for sensor {}, falling back to GENERIC",
                            resolvedLabel, deviceId);
                }
                newSensor.setIdDeviceType(idDeviceType); // ✅ FK directe

                try {
                    sensorDao.insertSensor(newSensor);
                    log.info("[SensorSync] Created sensor {} from TTN (DevEUI: {}, type: {})",
                            deviceId, devEui, resolvedLabel);
                    syncCount++;
                } catch (Exception e) {
                    log.error("[SensorSync] Failed to create sensor {} from TTN: {}", deviceId, e.getMessage());
                }
                existing = Optional.of(newSensor);
            }
        }

        log.info("[SensorSync] Synchronized {} sensors from TTN for gateway {}", syncCount, gatewayId);
        return syncCount;
    }

    public int syncGateway(String gatewayId) {
        int syncCount = syncSensorsFromTTN(gatewayId);
        syncSensorsData(gatewayId, null);
        gatewayService.syncMonitoringDataSnapshot(gatewayId);
        return syncCount;
    }

    @Transactional
    public void syncSensorsData(String gatewayId, Instant after) {
        try {
            final String appId;
            if ("leva-rpi-mantu".equalsIgnoreCase(gatewayId)) {
                appId = "lorawan-network-mantu";
            } else {
                appId = gatewayId + "-appli";
            }

            sensorService.getGatewayDevices(appId, after)
                    .doOnSubscribe(s -> log.info("[SensorSync] SUBSCRIBE appId={}, after={}", appId, after))
                    .doOnNext(j -> log.info("[SensorSync] NEXT {} bytes", j == null ? 0 : j.length()))
                    .doOnError(e -> log.error("[SensorSync] STREAM ERROR appId={}, after={}", appId, after, e))
                    .doOnComplete(() -> log.warn("[SensorSync] STREAM COMPLETE appId={}, after={}", appId, after))
                    .filter(json -> json != null && !json.isBlank())
                    .doOnNext(json -> {
                        try {
                            storeDataFromPayload(json, appId);
                        } catch (Exception e) {
                            log.error("[SensorSync] Error inserting sensor data: {}", e.getMessage(), e);
                        }
                    })
                    .subscribe();

        } catch (Exception e) {
            log.error("[SensorSync] Error syncing sensors data: {}", e.getMessage(), e);
        }
    }

    public void startPeriodicSync(String gatewayId) {
        if (scheduledSyncTasks.containsKey(gatewayId)) {
            log.info("[SensorSync] Periodic sync for gateway {} is already running.", gatewayId);
            return;
        }
        initialSyncCompleted.putIfAbsent(gatewayId, new AtomicBoolean(false));

        Runnable syncTask = () -> {
            log.info("[SensorSync] Starting periodic data sync for gateway: {}", gatewayId);
            try {
                boolean isInitialSync = !initialSyncCompleted.get(gatewayId).getAndSet(true);
                if (isInitialSync) {
                    log.info("[SensorSync] Performing initial full data sync for gateway: {}", gatewayId);
                    syncSensorsData(gatewayId, null);
                    gatewayService.syncMonitoringDataSnapshot(gatewayId);
                } else {
                    Instant after = Instant.now().minus(
                            SENSOR_DATA_SYNC_ROLLBACK_TIME_MINUTE, TimeUnit.MINUTES.toChronoUnit());
                    log.info("[SensorSync] Performing periodic data sync for gateway: {} with after={}", gatewayId, after);
                    syncSensorsData(gatewayId, after);
                    gatewayService.syncMonitoringDataSnapshot(gatewayId);
                }
                log.info("[SensorSync] Completed periodic data sync for gateway: {}", gatewayId);
            } catch (Exception e) {
                log.error("[SensorSync] Error during periodic data sync for gateway {}: {}", gatewayId, e.getMessage(), e);
            }
        };

        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(syncTask, 0, SENSOR_DATA_SYNC_PERIOD_MINUTE, TimeUnit.MINUTES);
        scheduledSyncTasks.put(gatewayId, future);
        log.info("[SensorSync] Scheduled periodic data sync for gateway {} every {} minutes.", gatewayId, SENSOR_DATA_SYNC_PERIOD_MINUTE);
    }

    public void stopPeriodicSync(String gatewayId) {
        ScheduledFuture<?> future = scheduledSyncTasks.remove(gatewayId);
        if (future != null) {
            initialSyncCompleted.remove(gatewayId);
            future.cancel(true);
            log.info("[SensorSync] Stopped periodic data sync for gateway: {}", gatewayId);
        } else {
            log.warn("[SensorSync] No periodic sync task found for gateway: {}", gatewayId);
        }
    }

    @PostConstruct
    public void initPeriodicSyncs() {
        log.info("[SensorSync] Initializing periodic syncs for all active gateways...");
        List<Gateway> allGateways = gatewayService.getAllGateways();
        try {
            for (Gateway gateway : allGateways) {
                startPeriodicSync(gateway.getGatewayId());
            }
            log.info("[SensorSync] Finished initializing periodic syncs. {} tasks scheduled.", allGateways.size());
        } catch (Exception e) {
            log.error("[SensorSync] Error initializing periodic syncs: {}", e.getMessage(), e);
            log.info("[SensorSync] Found {} gateways but failed to schedule all tasks.", allGateways.size());
        }
    }

    @PreDestroy
    public void shutdownScheduler() {
        log.info("[SensorSync] Shutting down periodic sync scheduler...");
        scheduler.shutdownNow();
        try {
            if (!scheduler.awaitTermination(30, TimeUnit.SECONDS)) {
                log.warn("[SensorSync] Scheduler did not terminate in time.");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("[SensorSync] Scheduler shutdown interrupted.", e);
        }
        log.info("[SensorSync] Periodic sync scheduler shut down.");
    }

    private String detectDeviceType(String deviceId) {
        if (deviceId == null) return "GENERIC";
        String lower = deviceId.toLowerCase();
        if (lower.startsWith("desk"))   return "DESK";
        if (lower.startsWith("co2"))    return "CO2";
        if (lower.startsWith("occup"))  return "OCCUP";
        if (lower.startsWith("pir"))    return "PIR_LIGHT";
        if (lower.startsWith("tempex")) return "TEMPEX";
        if (lower.startsWith("son"))    return "SON";
        if (lower.startsWith("eye"))    return "EYE";
        if (lower.startsWith("count"))  return "COUNT";
        return "GENERIC";
    }

    public SyncReport compareWithTTN(String gatewayId) {
        List<TtnDeviceInfo.EndDevice> ttnDevices = fetchDevicesFromTTN(gatewayId);
        List<Sensor> dbSensors = sensorDao.findAllSensors().stream()
                .filter(s -> gatewayId.equals(s.getIdGateway()))
                .collect(Collectors.toList());

        SyncReport report = new SyncReport();
        report.setGatewayId(gatewayId);
        report.setTtnDeviceCount(ttnDevices.size());
        report.setDbSensorCount(dbSensors.size());

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

    @lombok.Data
    public static class SyncReport {
        private String gatewayId;
        private int ttnDeviceCount;
        private int dbSensorCount;
        private List<String> missingInDb;
        private List<String> missingInTtn;
    }

    public void storeDataFromPayload(String json, String appId) {
        Configuration conf = Configuration.defaultConfiguration()
                .addOptions(Option.DEFAULT_PATH_LEAF_TO_NULL)
                .addOptions(Option.SUPPRESS_EXCEPTIONS);

        DocumentContext context = JsonPath.using(conf).parse(json);

        String receivedAtString = context.read("$.result.received_at");
        if (receivedAtString == null) receivedAtString = context.read("$.received_at");

        String deviceId = context.read("$.result.end_device_ids.device_id");
        if (deviceId == null) deviceId = context.read("$.end_device_ids.device_id");

        if (deviceId == null || receivedAtString == null) {
            log.warn("[SensorSync] Payload missing deviceId or received_at. appId={}, rawHead={}",
                    appId, json.substring(0, Math.min(300, json.length())));
            return;
        }

        LocalDateTime receivedAt = convertTimestampToLocalDateTime(receivedAtString);
        int inserted = 0;

        try {
            for (var entry : JSON_PATH_MAP.entrySet()) {
                PayloadValueType key = entry.getKey();
                if (!ALLOWED_TYPES.contains(key)) continue;
                String jsonPath = entry.getValue();

                String basePrefix =
                        context.read("$.result") != null ? "$.result." :
                                context.read("$.data")   != null ? "$.data."   :
                                        "$.";

                Object value = context.read(jsonPath.replace("$.", basePrefix));
                if (value != null) {
                    SensorData sd = new SensorData(deviceId, receivedAt, value.toString(), key.toString());
                    sensorDataDao.insertSensorData(sd);
                    inserted++;
                }
            }

            if (inserted == 0 && deviceId.toLowerCase().startsWith("tempex")) {
                log.warn("[SensorSync] TEMPEX payload produced 0 extracted values. appId={}, deviceId={}, receivedAt={}, raw={}",
                        appId, deviceId, receivedAtString, json);
            }

        } catch (Exception e) {
            if (!(e instanceof DuplicateKeyException)) {
                log.error("[SensorSync] Error decoding payload: {}", e.getMessage(), e);
            }
        }

        if (inserted == 0) {
            log.warn("[SensorSync] 0 values extracted. appId={}, deviceId={}, receivedAt={}, rawHead={}",
                    appId, deviceId, receivedAtString, json.substring(0, Math.min(300, json.length())));
        } else {
            log.info("[SensorSync] Inserted {} metrics for deviceId={} at {}", inserted, deviceId, receivedAt);
        }
    }

    private static LocalDateTime convertTimestampToLocalDateTime(String receivedAtNode) {
        if (receivedAtNode == null || receivedAtNode.isEmpty()) {
            log.warn("receivedAtNode is null or empty");
            return LocalDateTime.now();
        }
        return LocalDateTime.ofInstant(Instant.parse(receivedAtNode), ZoneId.systemDefault());
    }
}
