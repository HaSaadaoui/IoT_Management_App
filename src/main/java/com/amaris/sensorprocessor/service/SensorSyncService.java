package com.amaris.sensorprocessor.service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;


import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amaris.sensorprocessor.entity.Gateway;
import com.amaris.sensorprocessor.entity.SensorData.EnumValueType;
import com.amaris.sensorprocessor.entity.SensorData.SensorData;
import com.amaris.sensorprocessor.entity.Sensor;
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
                existing = Optional.of(newSensor);
            }
            
        }
    
        log.info("[SensorSync] Synchronized {} sensors from TTN for gateway {}", syncCount, gatewayId);
        return syncCount;
    }

    public int syncGateway(String gatewayId) {
        int syncCount = syncSensorsFromTTN(gatewayId);
        syncSensorsData(gatewayId);
        return syncCount;
    }


    /**
     * Récupère les données de monitoring d'une gateway et les enregistre dans la base de données.
     * Cette méthode s'abonne à un flux SSE de données de monitoring, décode chaque payload
     * et insère les données de capteur résultantes dans la base de données. La fonction est exécuté une seule fois.
     *
     * @param gatewayId L'identifiant de la gateway pour laquelle synchroniser les données.
     */
    @Transactional
    public void syncSensorsData(String gatewayId) {
        // Fetch latest data from monitoring API
        String appId = "leva-rpi-mantu".equalsIgnoreCase(gatewayId) ? "lorawan-network-mantu" : gatewayId + "-appli";

        sensorService.getGatewayDevices(appId)
        .takeWhile(json -> !"".equalsIgnoreCase(json))
        .map(
            (String json) -> {
                try {
                    storeDataFromPayload(json, appId);
                    return true;
                } catch (Exception e) {
                    log.error("[SensorSync] Error inserting sensor data: {}", e.getMessage(), e);
                }
                return false;
            }
        ).subscribe();
    }

    /**
     * Schedules a periodic background task to synchronize sensor data for a given gateway.
     * The task will run every 15 minutes.
     *
     * @param gatewayId The ID of the gateway for which to schedule the periodic sync.
     */
    public void startPeriodicSync(String gatewayId) {
        if (scheduledSyncTasks.containsKey(gatewayId)) {
            log.info("[SensorSync] Periodic sync for gateway {} is already running.", gatewayId);
            return;
        }

        Runnable syncTask = () -> {
            log.info("[SensorSync] Starting periodic data sync for gateway: {}", gatewayId);
            try {
                syncSensorsData(gatewayId);
                log.info("[SensorSync] Completed periodic data sync for gateway: {}", gatewayId);
            } catch (Exception e) {
                log.error("[SensorSync] Error during periodic data sync for gateway {}: {}", gatewayId, e.getMessage(), e);
            }
        };

        // Schedule to run every 15 minutes
        ScheduledFuture<?> future = scheduler.scheduleAtFixedRate(syncTask, 0, 15, TimeUnit.MINUTES);
        scheduledSyncTasks.put(gatewayId, future);
        log.info("[SensorSync] Scheduled periodic data sync for gateway {} to run every 15 minutes.", gatewayId);
    }

    /**
     * Stops the periodic background task for a given gateway.
     *
     * @param gatewayId The ID of the gateway for which to stop the periodic sync.
     */
    public void stopPeriodicSync(String gatewayId) {
        ScheduledFuture<?> future = scheduledSyncTasks.remove(gatewayId);
        if (future != null) {
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
        for (Gateway gateway : allGateways) {
            startPeriodicSync(gateway.getGatewayId());
        }
        log.info("[SensorSync] Finished initializing periodic syncs. {} tasks scheduled.", allGateways.size());
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

    // TODO: refactor in its own class file with normalizeToMonitoringSensorDataJson
    public void storeDataFromPayload(String json, String appId) {
        /*
            * result.end_device_ids
            * result.end_device_ids.application_ids
            * result.end_device_ids.application_ids.application_id
            * result.end_device_ids.dev_addr
            * result.end_device_ids.dev_eui
            * result.end_device_ids.device_id
            * result.received_at
            * result.uplink_message
            * result.uplink_message.confirmed
            * result.uplink_message.consumed_airtime
            * result.uplink_message.decoded_payload
            * result.uplink_message.decoded_payload.LAI
            * result.uplink_message.decoded_payload.LAImax
            * result.uplink_message.decoded_payload.LAeq
            * result.uplink_message.decoded_payload.battery
            * result.uplink_message.decoded_payload.co2
            * result.uplink_message.decoded_payload.distance
            * result.uplink_message.decoded_payload.humidity
            * result.uplink_message.decoded_payload.illuminance
            * result.uplink_message.decoded_payload.light
            * result.uplink_message.decoded_payload.motion
            * result.uplink_message.decoded_payload.occupancy
            * result.uplink_message.decoded_payload.period_in
            * result.uplink_message.decoded_payload.period_out
            * result.uplink_message.decoded_payload.temperature
            * result.uplink_message.decoded_payload.vdd
            * result.uplink_message.f_cnt
            * result.uplink_message.f_port
            * result.uplink_message.frm_payload
            * result.uplink_message.last_battery_percentage
            * result.uplink_message.last_battery_percentage.f_cnt
            * result.uplink_message.last_battery_percentage.received_at
            * result.uplink_message.last_battery_percentage.value
            * result.uplink_message.network_ids
            * result.uplink_message.network_ids.cluster_address
            * result.uplink_message.network_ids.cluster_id
            * result.uplink_message.network_ids.net_id
            * result.uplink_message.network_ids.ns_id
            * result.uplink_message.network_ids.tenant_id
            * result.uplink_message.packet_error_rate
            * result.uplink_message.received_at
            * result.uplink_message.rx_metadata
            * result.uplink_message.rx_metadata.[0]
            * result.uplink_message.rx_metadata.[0].channel_index
            * result.uplink_message.rx_metadata.[0].channel_rssi
            * result.uplink_message.rx_metadata.[0].frequency_offset
            * result.uplink_message.rx_metadata.[0].gateway_ids
            * result.uplink_message.rx_metadata.[0].gateway_ids.eui
            * result.uplink_message.rx_metadata.[0].gateway_ids.gateway_id
            * result.uplink_message.rx_metadata.[0].gps_time
            * result.uplink_message.rx_metadata.[0].location
            * result.uplink_message.rx_metadata.[0].location.altitude
            * result.uplink_message.rx_metadata.[0].location.latitude
            * result.uplink_message.rx_metadata.[0].location.longitude
            * result.uplink_message.rx_metadata.[0].location.source
            * result.uplink_message.rx_metadata.[0].received_at
            * result.uplink_message.rx_metadata.[0].rssi
            * result.uplink_message.rx_metadata.[0].snr
            * result.uplink_message.rx_metadata.[0].time
            * result.uplink_message.rx_metadata.[0].timestamp
            * result.uplink_message.settings
            * result.uplink_message.settings.data_rate
            * result.uplink_message.settings.data_rate.lora
            * result.uplink_message.settings.data_rate.lora.bandwidth
            * result.uplink_message.settings.data_rate.lora.coding_rate
            * result.uplink_message.settings.data_rate.lora.spreading_factor
            * result.uplink_message.settings.frequency
            * result.uplink_message.settings.time
            * result.uplink_message.settings.timestamp
            */

        Configuration conf = Configuration
            .defaultConfiguration()
            .addOptions(Option.DEFAULT_PATH_LEAF_TO_NULL)
            .addOptions(Option.SUPPRESS_EXCEPTIONS);

        DocumentContext context = JsonPath.using(conf).parse(json);
        String receivedAtString = context.read("$.result.received_at");
        LocalDateTime receivedAt = convertTimestampToLocalDateTime(receivedAtString);
        String deviceId = context.read("$.result.end_device_ids.device_id");
        try {

            HashMap<EnumValueType, Object> sensorDataMap = new HashMap<>();
            
            sensorDataMap.put(EnumValueType.APPLICATION_ID, context.read("$.result.end_device_ids.application_ids.application_id"));
            sensorDataMap.put(EnumValueType.BATTERY, context.read("$.result.uplink_message.decoded_payload.battery"));
            sensorDataMap.put(EnumValueType.CHANNEL_INDEX, context.read("$.result.uplink_message.rx_metadata.[0].channel_index"));
            sensorDataMap.put(EnumValueType.CHANNEL_RSSI, context.read("$.result.uplink_message.rx_metadata.[0].channel_rssi"));
            sensorDataMap.put(EnumValueType.CO2, context.read("$.result.uplink_message.decoded_payload.co2"));
            sensorDataMap.put(EnumValueType.CONFIRMED, context.read("$.result.uplink_message.confirmed"));
            sensorDataMap.put(EnumValueType.CONSUMED_AIRTIME, context.read("$.result.uplink_message.consumed_airtime"));
            sensorDataMap.put(EnumValueType.DEV_ADDR, context.read("$.result.end_device_ids.dev_addr"));
            sensorDataMap.put(EnumValueType.DEV_EUI, context.read("$.result.end_device_ids.dev_eui"));
            sensorDataMap.put(EnumValueType.DEVICE_ID, context.read("$.result.end_device_ids.device_id"));
            sensorDataMap.put(EnumValueType.DISTANCE, context.read("$.result.uplink_message.decoded_payload.distance"));
            sensorDataMap.put(EnumValueType.F_CNT, context.read("$.result.uplink_message.f_cnt"));
            sensorDataMap.put(EnumValueType.F_PORT, context.read("$.result.uplink_message.f_port"));
            sensorDataMap.put(EnumValueType.FREQUENCY_OFFSET, context.read("$.result.uplink_message.rx_metadata.[0].frequency_offset"));
            sensorDataMap.put(EnumValueType.FRM_PAYLOAD, context.read("$.result.uplink_message.frm_payload"));
            sensorDataMap.put(EnumValueType.GPS_TIME, context.read("$.result.uplink_message.rx_metadata.[0].gps_time"));
            sensorDataMap.put(EnumValueType.HUMIDITY, context.read("$.result.uplink_message.decoded_payload.humidity"));
            sensorDataMap.put(EnumValueType.ILLUMINANCE, context.read("$.result.uplink_message.decoded_payload.illuminance"));
            sensorDataMap.put(EnumValueType.LAEQ, context.read("$.result.uplink_message.decoded_payload.LAeq"));
            sensorDataMap.put(EnumValueType.LAI, context.read("$.result.uplink_message.decoded_payload.LAI"));
            sensorDataMap.put(EnumValueType.LAIMAX, context.read("$.result.uplink_message.decoded_payload.LAImax"));
            sensorDataMap.put(EnumValueType.LAST_BATTERY_PERCENTAGE_F_CNT, context.read("$.result.uplink_message.last_battery_percentage.f_cnt"));
            sensorDataMap.put(EnumValueType.LAST_BATTERY_PERCENTAGE_RECEIVED_AT, context.read("$.result.uplink_message.last_battery_percentage.received_at"));
            sensorDataMap.put(EnumValueType.LAST_BATTERY_PERCENTAGE_VALUE, context.read("$.result.uplink_message.last_battery_percentage.value"));
            sensorDataMap.put(EnumValueType.LAST_BATTERY_PERCENTAGE, context.read("$.result.uplink_message.last_battery_percentage.value"));
            sensorDataMap.put(EnumValueType.LIGHT, context.read("$.result.uplink_message.decoded_payload.light"));
            sensorDataMap.put(EnumValueType.LOCATION_ALTITUDE, context.read("$.result.uplink_message.rx_metadata.[0].location.altitude"));
            sensorDataMap.put(EnumValueType.LOCATION_LATITUDE, context.read("$.result.uplink_message.rx_metadata.[0].location.latitude"));
            sensorDataMap.put(EnumValueType.LOCATION_LONGITUDE, context.read("$.result.uplink_message.rx_metadata.[0].location.longitude"));
            sensorDataMap.put(EnumValueType.LOCATION_SOURCE, context.read("$.result.uplink_message.rx_metadata.[0].location.source"));
            sensorDataMap.put(EnumValueType.LORA_BANDWIDTH, context.read("$.result.uplink_message.settings.data_rate.lora.bandwidth"));
            sensorDataMap.put(EnumValueType.LORA_CODING_RATE, context.read("$.result.uplink_message.settings.data_rate.lora.coding_rate"));
            sensorDataMap.put(EnumValueType.LORA_SPREADING_FACTOR, context.read("$.result.uplink_message.settings.data_rate.lora.spreading_factor"));
            sensorDataMap.put(EnumValueType.MOTION, context.read("$.result.uplink_message.decoded_payload.motion"));
            sensorDataMap.put(EnumValueType.NETWORK_CLUSTER_ADDRESS, context.read("$.result.uplink_message.network_ids.cluster_address"));
            sensorDataMap.put(EnumValueType.NETWORK_CLUSTER_ID, context.read("$.result.uplink_message.network_ids.cluster_id"));
            sensorDataMap.put(EnumValueType.NETWORK_NET_ID, context.read("$.result.uplink_message.network_ids.net_id"));
            sensorDataMap.put(EnumValueType.NETWORK_NS_ID, context.read("$.result.uplink_message.network_ids.ns_id"));
            sensorDataMap.put(EnumValueType.NETWORK_TENANT_ID, context.read("$.result.uplink_message.network_ids.tenant_id"));
            sensorDataMap.put(EnumValueType.OCCUPANCY, context.read("$.result.uplink_message.decoded_payload.occupancy"));
            sensorDataMap.put(EnumValueType.PACKET_ERROR_RATE, context.read("$.result.uplink_message.packet_error_rate"));
            sensorDataMap.put(EnumValueType.PERIOD_IN, context.read("$.result.uplink_message.decoded_payload.period_in"));
            sensorDataMap.put(EnumValueType.PERIOD_OUT, context.read("$.result.uplink_message.decoded_payload.period_out"));
            sensorDataMap.put(EnumValueType.RECEIVED_AT, context.read("$.result.received_at"));
            sensorDataMap.put(EnumValueType.RSSI, context.read("$.result.uplink_message.rx_metadata.[0].rssi"));
            sensorDataMap.put(EnumValueType.SETTINGS_FREQUENCY, context.read("$.result.uplink_message.settings.frequency"));
            sensorDataMap.put(EnumValueType.SETTINGS_TIME, context.read("$.result.uplink_message.settings.time"));
            sensorDataMap.put(EnumValueType.SETTINGS_TIMESTAMP, context.read("$.result.uplink_message.settings.timestamp"));
            sensorDataMap.put(EnumValueType.SNR, context.read("$.result.uplink_message.rx_metadata.[0].snr"));
            sensorDataMap.put(EnumValueType.TEMPERATURE, context.read("$.result.uplink_message.decoded_payload.temperature"));
            sensorDataMap.put(EnumValueType.TIME, context.read("$.result.uplink_message.rx_metadata.[0].time"));
            sensorDataMap.put(EnumValueType.TIMESTAMP, context.read("$.result.uplink_message.rx_metadata.[0].timestamp"));
            sensorDataMap.put(EnumValueType.VDD, context.read("$.result.uplink_message.decoded_payload.vdd"));
            
            for (Map.Entry<EnumValueType, Object> entry : sensorDataMap.entrySet()) {
                EnumValueType key = entry.getKey();
                Object value = entry.getValue();

                if (value != null) {
                    SensorData sd = new SensorData(deviceId, receivedAt, value.toString(), key.toString());
                    sensorDataDao.insertSensorData(sd);
                } else {
                    log.debug("[SensorSync] Skipping null value for key {} for device {}", key, deviceId);
                }
            }

        } catch (Exception e) {
            if (e instanceof DuplicateKeyException) {
                log.warn("[SensorSync] Duplicate key exception, likely a retry or already processed data for device {}", deviceId);
            } else {
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
