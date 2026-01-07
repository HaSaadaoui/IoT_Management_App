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
/**
 * Service pour synchroniser les sensors depuis TTN vers la DB locale
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SensorSyncService {

    private final SensorLorawanService lorawanService;
    private final SensorService sensorService;

    private final SensorDataDao sensorDataDao;

    private final SensorDao sensorDao;

    private final ObjectMapper objectMapper;
    private final GatewayService gatewayService;
    
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(Math.max(1, Runtime.getRuntime().availableProcessors() / 2));
    private final Map<String, ScheduledFuture<?>> scheduledSyncTasks = new ConcurrentHashMap<>();
    private final Map<String, AtomicBoolean> initialSyncCompleted = new ConcurrentHashMap<>();

    private static final Map<PayloadValueType, String> JSON_PATH_MAP;

    static {
        JSON_PATH_MAP = Arrays.stream(PayloadValueType.values())
            .filter(e -> e.getJsonPath() != null)
            .collect(Collectors.toMap(
                e -> e,
                PayloadValueType::getJsonPath,
                (v1, v2) -> v2, // In case of duplicates, keep the last one
                () -> new EnumMap<>(PayloadValueType.class)
            ));
    }

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
                String detected = detectDeviceType(deviceId);              // ex: TEMPEX / CO2 / ...
                String type = ("GENERIC".equals(detected) && devEui != null) ? devEui : detected;
                newSensor.setDeviceType(type);
                
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
                existing = Optional.of(newSensor);
            }
            
        }
    
        log.info("[SensorSync] Synchronized {} sensors from TTN for gateway {}", syncCount, gatewayId);
        return syncCount;
    }

    public int syncGateway(String gatewayId) {
        int syncCount = syncSensorsFromTTN(gatewayId);
        syncSensorsData(gatewayId, null);
        return syncCount;
    }


    /**
     * Récupère les données de monitoring d'une gateway et les enregistre dans la base de données.
     * Cette méthode s'abonne à un flux SSE de données de monitoring, décode chaque payload
     * et insère les données de capteur résultantes dans la base de données. La fonction est exécuté une seule fois.
     *
     * @param gatewayId L'identifiant de la gateway pour laquelle synchroniser les données.
     * @param after Timestamp pour ne récupérer que les données après ce moment. S'il est égal à null, le comportement par défaut s'appliquera.
     */
    @Transactional
    public void syncSensorsData(String gatewayId, Instant after) {
        try {
            // Fetch latest data from monitoring API
            final String appId;
            if (gatewayId.toLowerCase().equals("leva-rpi-mantu")) {
                appId = "lorawan-network-mantu";
            } else if (gatewayId.equals("lil-rip-mantu")) {
                appId = "lil-rpi-mantu-appli";
            } else if (gatewayId.equals("rpi-mantu")) {
                appId = "rpi-mantu-appli";
            } else {
                appId = gatewayId + "-mantu-appli";
            }

            sensorService.getGatewayDevices(appId, after)
                    .takeWhile(json -> {
                        var val = !"".equalsIgnoreCase(json);
                        return val;
                    })
                    .map(
                            (String json) -> {
                                try {
                                    storeDataFromPayload(json, appId);
                                    return true;
                                } catch (Exception e) {
                                    log.error("[SensorSync] Error inserting sensor data: {}", e.getMessage(), e);
                                }
                                return false;
                            })
                    .subscribe();
        } catch (Exception e) {
            log.error("[SensorSync] Error syncing sensors data: {}", e.getMessage(), e);
        }
    }

    /**
     * Schedules a periodic background task to synchronize sensor data for a given gateway.
     * The task will run every SENSOR_DATA_SYNC_PERIOD minutes.
     *
     * @param gatewayId The ID of the gateway for which to schedule the periodic sync.
     */
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
                }
                else {
                    Instant after = Instant.now().minus(
                            SENSOR_DATA_SYNC_ROLLBACK_TIME_MINUTE, TimeUnit.MINUTES.toChronoUnit());
                    log.info("[SensorSync] Performing periodic data sync for gateway: {} with after={}", gatewayId, after);
                    syncSensorsData(gatewayId, after);
                }
                log.info("[SensorSync] Completed periodic data sync for gateway: {}", gatewayId);
            } catch (Exception e) {
                log.error("[SensorSync] Error during periodic data sync for gateway {}: {}", gatewayId, e.getMessage(), e);
            }
        };

        // Schedule to run every SENSOR_DATA_SYNC_PERIOD minutes
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(syncTask, 0, SENSOR_DATA_SYNC_PERIOD_MINUTE, TimeUnit.MINUTES);
        scheduledSyncTasks.put(gatewayId, future);
        log.info("[SensorSync] Scheduled periodic data sync for gateway {} to run every {} minutes.", SENSOR_DATA_SYNC_PERIOD_MINUTE, gatewayId);
    }

    /**
     * Stops the periodic background task for a given gateway.
     *
     * @param gatewayId The ID of the gateway for which to stop the periodic sync.
     */
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

    /**
     * Initializes periodic synchronization tasks for all active gateways on application startup.
     */
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
            // Log the number of gateways found, even if scheduling failed for some.
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

    public void storeDataFromPayload(String json, String appId) {

        Configuration conf = Configuration
                .defaultConfiguration()
                .addOptions(Option.DEFAULT_PATH_LEAF_TO_NULL)
                .addOptions(Option.SUPPRESS_EXCEPTIONS);

        var reader = JsonPath.using(conf);
        DocumentContext context = reader.parse(json);

        String receivedAtString = context.read("$.result.received_at");
        LocalDateTime receivedAt = convertTimestampToLocalDateTime(receivedAtString);
        String deviceId = context.read("$.result.end_device_ids.device_id");

        int inserted = 0;

        try {
            for (var entry : JSON_PATH_MAP.entrySet()) {
                PayloadValueType key = entry.getKey();
                String jsonPath = entry.getValue();

                Object value;
                if (context.read("$.result") != null) {
                    value = context.read(jsonPath.replace("$.", "$.result."));
                } else if (context.read("$.data") != null) {
                    value = context.read(jsonPath.replace("$.", "$.data."));
                } else {
                    value = null;
                }

                if (value != null) {
                    SensorData sd = new SensorData(deviceId, receivedAt, value.toString(), key.toString());
                    sensorDataDao.insertSensorData(sd);
                    inserted++;
                } else {
                    log.debug("[SensorSync] Skipping null value for key {} for device {}", key, deviceId);
                }
            }

            // IMPORTANT : diagnostic ciblé TempEx
            if (inserted == 0 && deviceId != null && deviceId.toLowerCase().startsWith("tempex")) {
                log.warn("[SensorSync] TEMPEX payload produced 0 extracted values. appId={}, deviceId={}, receivedAt={}, raw={}",
                        appId, deviceId, receivedAtString, json);
            }

        } catch (Exception e) {
            if (!(e instanceof DuplicateKeyException)) {
                log.error("[SensorSync] Error decoding payload: {}", e.getMessage(), e);
            }
        }
    }

    /* -------- Helpers -------- */
    private static LocalDateTime convertTimestampToLocalDateTime(String receivedAtNode) {
        if (receivedAtNode == null || receivedAtNode.isEmpty()) {
            log.warn(receivedAtNode);
            return LocalDateTime.now();
        }
        // Parse the ISO 8601 timestamp string
        Instant instant = Instant.parse(receivedAtNode);
        // Convert to LocalDateTime in the system's default time zone
        return LocalDateTime.ofInstant(instant, ZoneId.systemDefault());
    }
        

}
